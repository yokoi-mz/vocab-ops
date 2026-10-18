import { countDoneGenerationsSince } from "@/features/generation";
import { getLanguageStatus } from "@/features/vocabulary";
import { getDatabase } from "@/shared/db";
import { listProposalWords, listVocabUpdates, type VocabUpdate } from "./vocab-update-repository";
import { vocabOpsSettings } from "./vocab-ops-settings";

export type RecentVocabUpdate = VocabUpdate & {
  // 更新案に入れた語。反映した語彙更新では「足した語・外した語」、見送った語彙更新では「足そうとした語・外そうとした語」
  additions: { lemma: string; meaning: string | null }[];
  removals: { lemma: string; meaning: string | null }[];
};

export function listRecentVocabUpdates(language: string, limit: number): RecentVocabUpdate[] {
  const db = getDatabase();
  const updates = listVocabUpdates(db, language, limit);
  const words = listProposalWords(
    db,
    updates.map((update) => update.id),
  );
  return updates.map((update) => ({
    ...update,
    additions: words.filter((word) => word.vocabUpdateId === update.id && word.candidateType === "addition"),
    removals: words.filter((word) => word.vocabUpdateId === update.id && word.candidateType === "removal"),
  }));
}

// 次の語彙更新まで、あと何回の文生成が要るか。
export function countGenerationsUntilNextUpdate(language: string): number {
  const { lastVocabUpdateSeq } = getLanguageStatus(language);
  return Math.max(0, vocabOpsSettings.generationsPerUpdate - countDoneGenerationsSince(language, lastVocabUpdateSeq));
}
