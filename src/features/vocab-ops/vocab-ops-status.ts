import { countDoneGenerationsSince, listActiveWordUsages, listDoneSeqs } from "@/features/generation";
import { getLanguageStatus, getVocabSnapshot } from "@/features/vocabulary";
import { getDatabase } from "@/shared/db";
import { listOpsEvents } from "@/shared/ops-log";
import { countAdditionCandidates, type AdditionCandidate } from "./addition-candidates";
import { findRemovalCandidates, type RemovalCandidate } from "./removal-candidates";
import { buildRunSteps, type RunStep, type VocabUpdateStep } from "./run-steps";
import {
  findVocabUpdate,
  listCandidates,
  listProposalWords,
  listValidations,
  listVocabUpdates,
  type CandidateRecord,
  type ValidationRecord,
  type VocabUpdate,
} from "./vocab-update-repository";
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

// ---- Ops の画面のための読み出し ----

// 今の時点の追加候補の集計（LLM の順位付けの前の、プログラムの集計）。
export function getAdditionTally(language: string): AdditionCandidate[] {
  return countAdditionCandidates(language, vocabOpsSettings.additionWindow);
}

export type RemovalWatchItem = RemovalCandidate & {
  // 今の削除の条件を満たしているか
  isCandidate: boolean;
};

// 手札語彙の語ごとの、削除の判定に使う数値。最後に使われてからの回数が多い順に、limit 語まで返す。
export function listRemovalWatch(language: string, limit: number): RemovalWatchItem[] {
  const snapshot = getVocabSnapshot(language);
  const all = findRemovalCandidates({
    activeWords: snapshot.activeWords,
    doneSeqs: listDoneSeqs(language),
    usages: listActiveWordUsages(language),
    minGenerationsSinceAdded: 0,
    recentWindow: vocabOpsSettings.removalRecentWindow,
    maxRecentUses: Number.POSITIVE_INFINITY,
  });
  return all.slice(0, limit).map((item) => ({
    ...item,
    isCandidate:
      item.evidence.generationsSinceAdded >= vocabOpsSettings.removalMinGenerationsSinceAdded &&
      item.evidence.recentUses <= vocabOpsSettings.removalMaxRecentUses,
  }));
}

export type VocabUpdateRun = VocabUpdate & {
  steps: RunStep[];
  candidates: CandidateRecord[];
  validations: ValidationRecord[];
};

// 語彙更新1回の詳細（ステップの並び、候補、検証で比べた文）。
export function getVocabUpdateRun(id: number): VocabUpdateRun | undefined {
  const db = getDatabase();
  const update = findVocabUpdate(db, id);
  if (update === undefined) {
    return undefined;
  }
  const events = listOpsEvents({ language: update.language, source: "vocab_update", referenceId: id, limit: 500, oldestFirst: true });
  const stepEvents = events.flatMap((event) => {
    const step = (event.detail as { step?: VocabUpdateStep } | null)?.step;
    return step === undefined ? [] : [{ step, message: event.message, createdAt: event.createdAt }];
  });
  return {
    ...update,
    steps: buildRunSteps(update, stepEvents),
    candidates: listCandidates(db, [id]),
    validations: listValidations(db, [id]),
  };
}
