import { countDoneGenerationsSince, listActiveWordUsages, listDoneSeqs } from "@/features/generation";
import {
  applyVocabUpdate,
  createVocabSnapshot,
  getLanguageStatus,
  getVocabSnapshot,
  getWordsByIds,
  recordVocabUpdateStart,
} from "@/features/vocabulary";
import { getDatabase } from "@/shared/db";
import { countAdditionCandidates, rankAdditionCandidates } from "./addition-candidates";
import { buildProposal } from "./proposal";
import { findRemovalCandidates } from "./removal-candidates";
import { CostLimitError, runValidation } from "./validation";
import {
  claimNextPendingVocabUpdate,
  countUnfinishedVocabUpdates,
  failVocabUpdate,
  finishVocabUpdate,
  insertCandidate,
  insertValidation,
  insertVocabUpdate,
  resetRunningVocabUpdates,
  setVocabUpdateContext,
  type ClaimedVocabUpdate,
  type VocabUpdateResult,
} from "./vocab-update-repository";
import { vocabOpsModel, vocabOpsPromptVersion, vocabOpsSettings } from "./vocab-ops-settings";

// 前回の語彙更新から、完了した文生成が決まった回数たまっていたら、語彙更新を「待ち」として書く。
// ワーカーが、文生成を1件処理するたびに呼ぶ。待ちに入れたら true を返す。
export function enqueueVocabUpdateIfDue(language: string): boolean {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const state = getLanguageStatus(language);
    const due =
      countUnfinishedVocabUpdates(db, language) === 0 &&
      countDoneGenerationsSince(language, state.lastVocabUpdateSeq) >= vocabOpsSettings.generationsPerUpdate;
    if (due) {
      insertVocabUpdate(db, language, recordVocabUpdateStart(language));
    }
    db.exec("COMMIT");
    return due;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// ワーカーが途中で止まったときに「実行中」のまま残った語彙更新を、待ちに戻す。ワーカーの起動時に呼ぶ。
export function recoverInterruptedVocabUpdates(): void {
  resetRunningVocabUpdates(getDatabase());
}

// 待ちの語彙更新を1件取り出して処理する。処理するものがなければ undefined を返す。
export async function runNextVocabUpdate(): Promise<{ update: ClaimedVocabUpdate; result: VocabUpdateResult | null } | undefined> {
  const db = getDatabase();
  const update = claimNextPendingVocabUpdate(db);
  if (update === undefined) {
    return undefined;
  }
  let spentUsd = 0;
  try {
    const result = await runVocabUpdate(update, (costUsd) => {
      spentUsd += costUsd;
      return spentUsd;
    });
    finishVocabUpdate(db, update.id, result);
    return { update, result };
  } catch (error) {
    const costUsd = spentUsd + (error instanceof CostLimitError ? error.costUsd : 0);
    failVocabUpdate(db, update.id, error instanceof Error ? error.message : String(error), costUsd);
    return { update, result: null };
  }
}

// 語彙更新1回の流れ（vocab-ops/README.md）。
// addCost は使った費用を足し、ここまでの合計（ドル）を返す。
async function runVocabUpdate(update: ClaimedVocabUpdate, addCost: (costUsd: number) => number): Promise<VocabUpdateResult> {
  const db = getDatabase();
  const settings = vocabOpsSettings;
  const limitUsd = settings.maxCostYen / settings.yenPerUsd;

  // 1. 増減モードと、今の手札語彙（この語彙更新では、最後までこの手札語彙を元にする）
  const { vocabSizeMode } = getLanguageStatus(update.language);
  const snapshot = getVocabSnapshot(update.language);
  setVocabUpdateContext(db, update.id, {
    vocabSizeMode,
    versionBefore: snapshot.version,
    model: vocabOpsModel,
    promptVersion: vocabOpsPromptVersion,
    settingsJson: JSON.stringify(settings),
  });

  // 2. 追加候補と削除候補
  const additionCandidates = countAdditionCandidates(update.language, settings.additionWindow);
  const ranking = await rankAdditionCandidates(update.language, additionCandidates, snapshot.activeWords);
  addCost(ranking.costUsd);
  const removalCandidates = findRemovalCandidates({
    activeWords: snapshot.activeWords,
    doneSeqs: listDoneSeqs(update.language),
    usages: listActiveWordUsages(update.language),
    minGenerationsSinceAdded: settings.removalMinGenerationsSinceAdded,
    recentWindow: settings.removalRecentWindow,
    maxRecentUses: settings.removalMaxRecentUses,
  });

  // 3. 増減モードに合わせた更新案
  const proposal = buildProposal(
    vocabSizeMode,
    ranking.ranked.map((item) => item.wordId),
    removalCandidates.map((candidate) => candidate.wordId),
    settings.maxAdditions,
    settings.maxRemovals,
  );

  // 候補と更新案を記録する（反映するかどうかにかかわらず）
  const rankedIds = ranking.ranked.map((item) => item.wordId);
  const unranked = additionCandidates.filter((candidate) => !rankedIds.includes(candidate.wordId));
  ranking.ranked.forEach((item, index) => {
    const candidate = additionCandidates.find((entry) => entry.wordId === item.wordId);
    insertCandidate(db, {
      vocabUpdateId: update.id,
      candidateType: "addition",
      wordId: item.wordId,
      rank: index + 1,
      reason: item.reason,
      evidenceJson: JSON.stringify({
        occurrences: candidate?.occurrences,
        generationIds: candidate?.generationIds,
        evidenceGenerationIds: item.evidenceGenerationIds,
      }),
      inProposal: proposal.additions.includes(item.wordId),
    });
  });
  unranked.forEach((candidate, index) => {
    insertCandidate(db, {
      vocabUpdateId: update.id,
      candidateType: "addition",
      wordId: candidate.wordId,
      rank: ranking.ranked.length + index + 1,
      reason: "LLM が、足す価値がないとして順位に入れなかった",
      evidenceJson: JSON.stringify({ occurrences: candidate.occurrences, generationIds: candidate.generationIds }),
      inProposal: false,
    });
  });
  removalCandidates.forEach((candidate, index) => {
    insertCandidate(db, {
      vocabUpdateId: update.id,
      candidateType: "removal",
      wordId: candidate.wordId,
      rank: index + 1,
      reason: candidate.reason,
      evidenceJson: JSON.stringify(candidate.evidence),
      inProposal: proposal.removals.includes(candidate.wordId),
    });
  });

  const skipped = (outcomeReason: string, extra: Partial<VocabUpdateResult> = {}): VocabUpdateResult => ({
    versionAfter: null,
    validationPerformed: false,
    improvedCount: null,
    worsenedCount: null,
    sameCount: null,
    outcome: "skipped",
    outcomeReason,
    costUsd: addCost(0),
    ...extra,
  });

  if (proposal.additions.length === 0 && proposal.removals.length === 0) {
    return skipped("増減モードに合う追加候補・削除候補がなかった");
  }

  // 4. 足す語と外す語の両方を含むときだけ、語彙更新検証を行う
  let validation: Pick<VocabUpdateResult, "validationPerformed" | "improvedCount" | "worsenedCount" | "sameCount"> = {
    validationPerformed: false,
    improvedCount: null,
    worsenedCount: null,
    sameCount: null,
  };
  if (proposal.additions.length > 0 && proposal.removals.length > 0) {
    const proposedActiveWords = [
      ...snapshot.activeWords.filter((word) => !proposal.removals.includes(word.id)),
      ...getWordsByIds(proposal.additions),
    ];
    const outcome = await runValidation({
      language: update.language,
      mode: vocabSizeMode,
      currentSnapshot: snapshot,
      proposedSnapshot: createVocabSnapshot(
        update.language,
        snapshot.version,
        snapshot.expandedOutsideWordLimit,
        proposedActiveWords,
        snapshot.uncountedWords,
      ),
      spentUsd: addCost(0),
      limitUsd,
    });
    addCost(outcome.costUsd);
    for (const pair of outcome.pairs) {
      insertValidation(db, {
        vocabUpdateId: update.id,
        sourceGenerationId: pair.sourceGenerationId,
        currentSetSentence: pair.currentSetSentence,
        currentSetReused: pair.currentSetReused,
        proposedSetSentence: pair.proposedSetSentence,
        presentedFirst: pair.presentedFirst,
        judgement: pair.judgement,
      });
    }
    validation = {
      validationPerformed: true,
      improvedCount: outcome.improved,
      worsenedCount: outcome.worsened,
      sameCount: outcome.same,
    };
    if (!outcome.passed) {
      return skipped(`語彙更新検証に不合格：${outcome.reason}`, validation);
    }
  }

  // 5. 手札語彙に反映する
  const reasonOf = (wordId: number) =>
    ranking.ranked.find((item) => item.wordId === wordId)?.reason ??
    removalCandidates.find((candidate) => candidate.wordId === wordId)?.reason ??
    "";
  const applied = applyVocabUpdate(
    update.language,
    update.id,
    snapshot.version,
    proposal.additions.map((wordId) => ({ wordId, reason: reasonOf(wordId) })),
    proposal.removals.map((wordId) => ({ wordId, reason: reasonOf(wordId) })),
  );
  if (!applied.applied) {
    return skipped(applied.reason, validation);
  }
  return {
    ...validation,
    versionAfter: applied.version,
    outcome: "applied",
    outcomeReason: `足す ${proposal.additions.length} 語・外す ${proposal.removals.length} 語を反映した${validation.validationPerformed ? "（語彙更新検証に合格）" : "（足すだけ・外すだけなので検証は不要）"}`,
    costUsd: addCost(0),
  };
}
