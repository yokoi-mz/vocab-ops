import { z } from "zod";
import {
  canReuseCurrentSetSentence,
  generateCurrentSetSentence,
  getDoneGenerationDetails,
  listDoneGenerations,
  type GenerationDetail,
} from "@/features/generation";
import type { VocabSizeMode, VocabSnapshot } from "@/features/vocabulary";
import { callOpenRouter } from "@/shared/openrouter";
import type { ValidationJudgement } from "./vocab-update-repository";
import { vocabOpsModel, vocabOpsSettings } from "./vocab-ops-settings";

// 語彙更新検証（05-validation.md）。足す語と外す語の両方を含む更新案だけに行う。
// 過去の履歴の原文それぞれについて、今の手札語彙文と提案語彙文を比べ、増減モードの合格の基準で判断する。

const concurrency = 5;
const judgeBatchSize = 10;

export type ValidationPair = {
  sourceGenerationId: number;
  message: string;
  currentSetSentence: string;
  currentSetReused: boolean;
  proposedSetSentence: string;
  presentedFirst: "current_set" | "proposed_set";
  judgement: ValidationJudgement | null;
};

export type ValidationCounts = { improved: number; worsened: number; same: number };

export type ValidationOutcome = ValidationCounts & {
  pairs: ValidationPair[];
  passed: boolean;
  reason: string;
  costUsd: number;
};

export class CostLimitError extends Error {
  constructor(readonly costUsd: number) {
    super("語彙更新の費用の上限に達したので、途中でやめた");
  }
}

// 検証に使う履歴を選ぶ。直近の recentWindow 件から recentCount 件、それより前から olderCount 件を、無作為に選ぶ。
export function selectValidationSources(
  generations: { id: number; seq: number }[],
  random: () => number = Math.random,
): number[] {
  const sorted = [...generations].sort((a, b) => b.seq - a.seq);
  const recent = sorted.slice(0, vocabOpsSettings.validationRecentWindow);
  const older = sorted.slice(vocabOpsSettings.validationRecentWindow);
  return [
    ...pickRandom(recent, vocabOpsSettings.validationRecentCount, random),
    ...pickRandom(older, vocabOpsSettings.validationOlderCount, random),
  ].map((generation) => generation.id);
}

function pickRandom<T>(items: T[], count: number, random: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

// 増減モードごとの合格の基準で、検証の結果を判断する（数値は parameters.md）。
export function decideValidation(mode: VocabSizeMode, counts: ValidationCounts): { passed: boolean; reason: string } {
  const total = counts.improved + counts.worsened + counts.same;
  const summary = `改善 ${counts.improved}・悪化 ${counts.worsened}・同等 ${counts.same}`;
  if (total === 0) {
    return { passed: false, reason: "比較判定ができた組がなかった" };
  }
  if (mode === "keep") {
    const margin = vocabOpsSettings.validationMinImprovedMargin;
    const passed = counts.improved - counts.worsened >= margin;
    return { passed, reason: `${summary}。変えないモードでは、改善が悪化より ${margin} 件以上多いことが条件` };
  }
  const maxRatio = vocabOpsSettings.validationMaxWorsenedRatio;
  const passed = counts.worsened / total <= maxRatio;
  return { passed, reason: `${summary}。悪化が ${Math.round(maxRatio * 100)}% 以下であることが条件` };
}

export async function runValidation(input: {
  language: string;
  mode: VocabSizeMode;
  currentSnapshot: VocabSnapshot;
  proposedSnapshot: VocabSnapshot;
  // ここまでに使った費用と、使ってよい上限（ドル）
  spentUsd: number;
  limitUsd: number;
}): Promise<ValidationOutcome> {
  let costUsd = 0;
  const overLimit = () => input.spentUsd + costUsd > input.limitUsd;
  const sources = getDoneGenerationDetails(selectValidationSources(listDoneGenerations(input.language)));

  const prepared = await mapWithConcurrency(sources, concurrency, async (source, index): Promise<ValidationPair | undefined> => {
    if (overLimit()) {
      return undefined;
    }
    try {
      const current = await currentSetSentenceFor(source, input.currentSnapshot);
      const proposed = await generateCurrentSetSentence(input.proposedSnapshot, source);
      costUsd += current.costUsd + proposed.costUsd;
      return {
        sourceGenerationId: source.id,
        message: source.message,
        currentSetSentence: current.sentence,
        currentSetReused: current.reused,
        proposedSetSentence: proposed.sentence,
        // 見せる順番が判定に影響しうるので、交互に入れ替える
        presentedFirst: index % 2 === 0 ? "current_set" : "proposed_set",
        judgement: null,
      };
    } catch {
      // この履歴の文を作れなかったときは、この組を飛ばす
      return undefined;
    }
  });
  if (overLimit()) {
    throw new CostLimitError(costUsd);
  }

  const pairs = prepared.filter((pair) => pair !== undefined);
  for (let start = 0; start < pairs.length; start += judgeBatchSize) {
    const batch = pairs.slice(start, start + judgeBatchSize);
    const result = await judgeBatch(batch);
    costUsd += result.costUsd;
    batch.forEach((pair, index) => {
      pair.judgement = result.judgements[index];
    });
  }

  const counts: ValidationCounts = {
    improved: pairs.filter((pair) => pair.judgement === "improved").length,
    worsened: pairs.filter((pair) => pair.judgement === "worsened").length,
    same: pairs.filter((pair) => pair.judgement === "same").length,
  };
  return { ...counts, ...decideValidation(input.mode, counts), pairs, costUsd };
}

async function currentSetSentenceFor(
  source: GenerationDetail,
  snapshot: VocabSnapshot,
): Promise<{ sentence: string; reused: boolean; costUsd: number }> {
  const saved = source.sentences.find((sentence) => sentence.sentenceType === "current_set");
  if (saved !== undefined && canReuseCurrentSetSentence(source, snapshot.version)) {
    return { sentence: saved.sentence, reused: true, costUsd: 0 };
  }
  const generated = await generateCurrentSetSentence(snapshot, source);
  return { ...generated, reused: false };
}

const answersSchema = z.object({
  answers: z.array(z.object({ problem: z.number(), answer: z.string() })),
});

// 複数の組をまとめて LLM に渡し、どちらの文が原文の意味をより忠実に表しているかを判定させる。
async function judgeBatch(pairs: ValidationPair[]): Promise<{ judgements: (ValidationJudgement | null)[]; costUsd: number }> {
  const problems = pairs.map((pair, index) => {
    const [first, second] =
      pair.presentedFirst === "current_set"
        ? [pair.currentSetSentence, pair.proposedSetSentence]
        : [pair.proposedSetSentence, pair.currentSetSentence];
    return `Problem ${index + 1}\nOriginal: ${pair.message}\nSentence 1: ${first}\nSentence 2: ${second}`;
  });
  const prompt = `A language learner wanted to say the ORIGINAL (Japanese). Two sentences try to express it in a foreign language.
For each problem, decide which sentence lets a listener understand the ORIGINAL more accurately and completely.

How to judge:
- Specific information matters most: places, things, people, times, actions, amounts.
  A sentence that names them (e.g. "station", "train", "meeting", "wait") is MORE faithful than one that replaces them
  with a vague paraphrase (e.g. "the place where we get on and get down", "the thing we take", "a place where we speak together").
- Information that is missing or changed makes a sentence LESS faithful (e.g. "airport" became "station", "coffee" became "this").
- Information that is not in the original, added to the sentence, makes it LESS faithful.
- Do NOT judge grammar, naturalness, style or length, except when they make the meaning unclear.
- Answer "same" only when a listener would understand essentially the same thing from both sentences.

For each problem, first write a short reason in English, then the answer: "1" (sentence 1 is more faithful), "2" (sentence 2 is more faithful) or "same".
Output ONLY one JSON object, no prose:
{"answers": [{"problem": 1, "reason": "...", "answer": "1"}, {"problem": 2, "reason": "...", "answer": "same"}]}

${problems.join("\n\n")}`;

  const result = await callOpenRouter(vocabOpsModel, [{ role: "user", content: prompt }]);
  const text = result.text;
  let parsed: z.infer<typeof answersSchema> | undefined;
  try {
    parsed = answersSchema.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
  } catch {
    parsed = undefined;
  }

  const judgements = pairs.map((pair, index): ValidationJudgement | null => {
    const answer = parsed?.answers.find((item) => item.problem === index + 1)?.answer.trim().toLowerCase();
    if (answer === "same") {
      return "same";
    }
    if (answer !== "1" && answer !== "2") {
      return null;
    }
    const firstWins = answer === "1";
    const proposedWins = pair.presentedFirst === "proposed_set" ? firstWins : !firstWins;
    return proposedWins ? "improved" : "worsened";
  });
  return { judgements, costUsd: result.costUsd };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
