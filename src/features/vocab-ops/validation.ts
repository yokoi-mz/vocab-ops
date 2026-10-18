import { z } from "zod";
import {
  canReuseCurrentSetSentence,
  generateCurrentSetSentence,
  getDoneGenerationDetails,
  listActiveWordUsages,
  listDoneGenerations,
  listOutsideWordAppearances,
  type GenerationDetail,
} from "@/features/generation";
import type { VocabSizeMode, VocabSnapshot } from "@/features/vocabulary";
import { callOpenRouter } from "@/shared/openrouter";
import type { ValidationJudgement } from "./vocab-update-repository";
import { vocabOpsModel, vocabOpsProvider, vocabOpsSettings } from "./vocab-ops-settings";

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

// 検証に使う履歴を選ぶ（合わせて validationRecentCount ＋ validationOlderCount 件まで）。
// まず、入れ替える語が関係する履歴（relevantIds）から選ぶ。外す語が使われた文生成や、足す語が拡張語彙文に出た文生成では、
// 語を入れ替えた影響が文に出やすいため。足りない分は、直近の recentWindow 件とそれより前から、件数の割合を保って無作為に選ぶ。
export function selectValidationSources(
  generations: { id: number; seq: number }[],
  relevantIds: Set<number>,
  random: () => number = Math.random,
): number[] {
  const { validationRecentWindow, validationRecentCount, validationOlderCount } = vocabOpsSettings;
  const total = validationRecentCount + validationOlderCount;
  const relevant = pickRandom(
    generations.filter((generation) => relevantIds.has(generation.id)),
    total,
    random,
  );

  const need = total - relevant.length;
  const rest = [...generations].filter((generation) => !relevantIds.has(generation.id)).sort((a, b) => b.seq - a.seq);
  const recentIds = new Set([...generations].sort((a, b) => b.seq - a.seq).slice(0, validationRecentWindow).map((generation) => generation.id));
  const recent = rest.filter((generation) => recentIds.has(generation.id));
  const older = rest.filter((generation) => !recentIds.has(generation.id));
  const olderPicked = pickRandom(older, Math.min(older.length, Math.round((need * validationOlderCount) / total)), random);
  const recentPicked = pickRandom(recent, need - olderPicked.length, random);
  const olderExtra = pickRandom(
    older.filter((generation) => !olderPicked.includes(generation)),
    need - olderPicked.length - recentPicked.length,
    random,
  );
  return [...relevant, ...recentPicked, ...olderPicked, ...olderExtra].map((generation) => generation.id);
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
  // 更新案で入れ替える語（足す語と外す語）の番号
  changedWordIds: number[];
  // ここまでに使った費用と、使ってよい上限（ドル）
  spentUsd: number;
  limitUsd: number;
  // 途中経過を知らせる（Ops の画面の記録に使う）
  onProgress: (message: string) => void;
}): Promise<ValidationOutcome> {
  let costUsd = 0;
  const overLimit = () => input.spentUsd + costUsd > input.limitUsd;
  const changed = new Set(input.changedWordIds);
  const relevantIds = new Set(
    [...listActiveWordUsages(input.language), ...listOutsideWordAppearances(input.language)]
      .filter((occurrence) => changed.has(occurrence.wordId))
      .map((occurrence) => occurrence.generationId),
  );
  const sourceIds = selectValidationSources(listDoneGenerations(input.language), relevantIds);
  const sources = getDoneGenerationDetails(sourceIds);
  input.onProgress(
    `語彙更新検証を開始：履歴 ${sources.length} 件（うち入れ替える語が関係する履歴 ${sourceIds.filter((id) => relevantIds.has(id)).length} 件）で、今の手札語彙文と提案語彙文を用意する`,
  );

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
  input.onProgress(
    `比べる文を ${pairs.length} 組用意した（手札語彙文の使い回し ${pairs.filter((pair) => pair.currentSetReused).length} 組・作れなかった履歴 ${sources.length - pairs.length} 件）`,
  );
  for (let start = 0; start < pairs.length; start += judgeBatchSize) {
    const batch = pairs.slice(start, start + judgeBatchSize);
    const result = await judgeBatch(batch);
    costUsd += result.costUsd;
    batch.forEach((pair, index) => {
      pair.judgement = result.judgements[index];
    });
    const judged = pairs.slice(0, start + batch.length);
    const count = (judgement: ValidationJudgement) => judged.filter((pair) => pair.judgement === judgement).length;
    input.onProgress(
      `比較判定 ${judged.length} / ${pairs.length} 組：改善 ${count("improved")}・悪化 ${count("worsened")}・同等 ${count("same")}`,
    );
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
  const currentFirst = (pair: ValidationPair) => pair.presentedFirst === "current_set";
  const problems = pairs.map((pair, index) => {
    const [first, second] = currentFirst(pair)
      ? [pair.currentSetSentence, pair.proposedSetSentence]
      : [pair.proposedSetSentence, pair.currentSetSentence];
    return `Problem ${index + 1}\nOriginal: ${pair.message}\nSentence 1: ${first}\nSentence 2: ${second}`;
  });
  // 2026-10-19 の実験で決めたプロンプト（docs/vocab-ops/experiments/2026-10-19-judge-prompt.md）
  const prompt = `A language learner wanted to say the ORIGINAL (Japanese). Two sentences try to say it in a foreign language
with a limited vocabulary, so both may use roundabout descriptions.
For each problem, decide whether one sentence conveys the ORIGINAL clearly better than the other.

Steps for each problem:
1. key_info: list the 2-4 most important pieces of information in the ORIGINAL (who, what action, what thing, where, when).
2. For each sentence, mark each piece: "ok" (named, or described so that a listener can tell what it is),
   "vague" (only a general word such as "thing" or "place"), "missing", or "wrong" (changed into something else).
   Also note information the sentence ADDS that is not in the ORIGINAL. Added information counts as "wrong".
3. answer:
   - "1" or "2": only if that sentence conveys at least one key piece clearly better than the other
     (for example "ok" against "vague", "missing" or "wrong"), and is not worse on any other key piece.
   - "same": if the marks are equal, if both are equally vague, if each sentence is better on a different piece,
     or if the sentences differ only in wording, style, length or grammar.

Output ONLY one JSON object, no prose:
{"answers": [{"problem": 1, "key_info": ["..."], "sentence_1": "...", "sentence_2": "...", "answer": "1"}]}

${problems.join("\n\n")}`;

  const result = await callOpenRouter(vocabOpsModel, [{ role: "user", content: prompt }], vocabOpsProvider);
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
    const proposedWins = currentFirst(pair) ? !firstWins : firstWins;
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
