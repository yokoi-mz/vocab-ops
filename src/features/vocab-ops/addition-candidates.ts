import { z } from "zod";
import { getDoneGenerationDetails, listDoneSeqs, listOutsideWordAppearances, type GenerationDetail } from "@/features/generation";
import { getLanguageRules, normalizeLemma } from "@/features/language";
import { getWordsByIds, type VocabWord } from "@/features/vocabulary";
import { callOpenRouter } from "@/shared/openrouter";
import { vocabOpsModel, vocabOpsProvider } from "./vocab-ops-settings";

// 追加候補（02-addition-candidates.md）。
// 直近の文生成の拡張語彙文に出てきた手札外語彙の語を数え（プログラム）、LLM に順位を付けさせる。

export type AdditionCandidate = {
  wordId: number;
  lemma: string;
  meaning: string | null;
  // 出てきた文生成の数（1回の文生成につき1回）と、その文生成の番号
  occurrences: number;
  generationIds: number[];
};

export type RankedAddition = {
  wordId: number;
  reason: string;
  evidenceGenerationIds: number[];
};

// 直近 window 件の完了した文生成で、拡張語彙文に出てきた手札外語彙の語を、出現回数の多い順に返す。
// 今は手札外語彙ではない語（すでに手札語彙・ノーカン語彙になった語）は除く。
export function countAdditionCandidates(language: string, window: number): AdditionCandidate[] {
  const recentSeqs = new Set(listDoneSeqs(language).slice(0, window));
  const appearances = listOutsideWordAppearances(language).filter((appearance) => recentSeqs.has(appearance.seq));

  const generationIdsByWord = new Map<number, number[]>();
  for (const appearance of appearances) {
    generationIdsByWord.set(appearance.wordId, [...(generationIdsByWord.get(appearance.wordId) ?? []), appearance.generationId]);
  }
  return getWordsByIds([...generationIdsByWord.keys()])
    .filter((word) => word.vocabStatus === "outside")
    .map((word) => {
      const generationIds = generationIdsByWord.get(word.id) ?? [];
      return { wordId: word.id, lemma: word.lemma, meaning: word.meaning, occurrences: generationIds.length, generationIds };
    })
    .sort((a, b) => b.occurrences - a.occurrences || a.lemma.localeCompare(b.lemma));
}

const rankingSchema = z.object({
  ranking: z.array(
    z.object({
      lemma: z.string(),
      reason: z.string().catch(""),
      evidence_generation_ids: z.array(z.number()).catch([]),
    }),
  ),
});

// LLM に、追加候補の順位を付けさせる。足す価値がないと判断した候補は、順位に入らない。
export async function rankAdditionCandidates(
  language: string,
  candidates: AdditionCandidate[],
  activeWords: VocabWord[],
): Promise<{ ranked: RankedAddition[]; costUsd: number }> {
  if (candidates.length === 0) {
    return { ranked: [], costUsd: 0 };
  }
  const generations = getDoneGenerationDetails([...new Set(candidates.flatMap((candidate) => candidate.generationIds))]);
  const result = await callOpenRouter(
    vocabOpsModel,
    [{ role: "user", content: buildRankingPrompt(language, candidates, activeWords, generations) }],
    vocabOpsProvider,
  );

  const text = result.text;
  const parsed = rankingSchema.safeParse(safeJsonParse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
  if (!parsed.success) {
    throw new Error("追加候補の順位付けの返事を読めませんでした。");
  }

  const candidatesByKey = new Map(candidates.map((candidate) => [normalizeLemma(candidate.lemma), candidate]));
  const ranked: RankedAddition[] = [];
  for (const item of parsed.data.ranking) {
    const candidate = candidatesByKey.get(normalizeLemma(item.lemma));
    if (candidate !== undefined && !ranked.some((entry) => entry.wordId === candidate.wordId)) {
      ranked.push({ wordId: candidate.wordId, reason: item.reason, evidenceGenerationIds: item.evidence_generation_ids });
    }
  }
  return { ranked, costUsd: result.costUsd };
}

function buildRankingPrompt(
  language: string,
  candidates: AdditionCandidate[],
  activeWords: VocabWord[],
  generations: GenerationDetail[],
): string {
  const languageName = getLanguageRules(language).englishName;
  const attempts = generations.map((generation) => {
    const sentence = (type: "current_set" | "expanded_set") => generation.sentences.find((item) => item.sentenceType === type);
    const current = sentence("current_set");
    const expanded = sentence("expanded_set");
    const extraWords = [
      ...new Set(expanded?.tokens.filter((token) => token.judgement === "outside").map((token) => token.lemma) ?? []),
    ];
    return `[attempt ${generation.id}]
Wanted to say: ${generation.message}${generation.situation ? ` (situation: ${generation.situation})` : ""}
Active-only sentence: ${current?.sentence ?? ""} (actual meaning: ${current?.translation ?? ""}) comment: ${current?.comment ?? ""}
Expanded sentence: ${expanded?.sentence ?? ""} (actual meaning: ${expanded?.translation ?? ""}) comment: ${expanded?.comment ?? ""}
Extra words used: ${extraWords.join(", ")}`;
  });

  return `You help a learner of ${languageName} decide which words to add to their ACTIVE VOCABULARY:
a small set of words they actually use when speaking.
Below are recent attempts. For each, you see what the learner wanted to say (Japanese),
a sentence made only with the active vocabulary, and an expanded sentence that may use a few extra words.
CANDIDATES are the extra words that appeared in the expanded sentences.

Rank the candidates by how useful it would be to add them to the active vocabulary. Consider:
- Does the word fill a gap? (something the learner wanted to say but could only paraphrase awkwardly or lose with the active vocabulary)
- Will the learner likely need it again in future conversations? (versatile, high-frequency)
- Avoid words that mostly duplicate the meaning of an existing active word (e.g. "listen" when "hear" is active).
- Check the candidate is a real dictionary form (lemma) of ${languageName}; leave out wrong lemmas.
Leave out candidates that are not worth adding. Do not give scores.

Output ONLY one JSON object, no prose:
{"ranking": [{"lemma": "candidate lemma exactly as listed", "reason": "短い日本語の理由（1文）", "evidence_generation_ids": [attempt ids that support it]}]}

== ACTIVE VOCABULARY (lemma: meaning) ==
${activeWords.map((word) => `${word.lemma}: ${word.meaning ?? ""}`).join("\n")}

== CANDIDATES (lemma: meaning — number of attempts it appeared in) ==
${candidates.map((candidate) => `${candidate.lemma}: ${candidate.meaning ?? ""} — ${candidate.occurrences}`).join("\n")}

== ATTEMPTS ==
${attempts.join("\n\n")}`;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
