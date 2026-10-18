import { countDoneGenerationsSince, listActiveWordUsages, listDoneSeqs } from "@/features/generation";
import {
  applyVocabUpdate,
  createVocabSnapshot,
  getLanguageStatus,
  getVocabSnapshot,
  getWordsByIds,
  recordVocabUpdateStart,
  type VocabSizeMode,
} from "@/features/vocabulary";
import { getDatabase } from "@/shared/db";
import { recordOpsEvent } from "@/shared/ops-log";
import { countAdditionCandidates, rankAdditionCandidates } from "./addition-candidates";
import { buildProposal } from "./proposal";
import type { VocabUpdateStep } from "./run-steps";
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
      !isPausedAtBaseline(state.vocabSizeMode, state.activeVocabVersion) &&
      countUnfinishedVocabUpdates(db, language) === 0 &&
      countDoneGenerationsSince(language, state.lastVocabUpdateSeq) >= vocabOpsSettings.generationsPerUpdate;
    let vocabUpdateId: number | null = null;
    if (due) {
      vocabUpdateId = insertVocabUpdate(db, language, recordVocabUpdateStart(language));
    }
    db.exec("COMMIT");
    if (vocabUpdateId !== null) {
      recordOpsEvent({
        language,
        source: "vocab_update",
        referenceId: vocabUpdateId,
        message: `前回の語彙更新から文生成が ${vocabOpsSettings.generationsPerUpdate} 回たまったので、語彙更新 ${vocabUpdateId} を待ちに入れた`,
        detail: { step: "queued" },
      });
    }
    return due;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// ベースラインのまま（手札語彙の版が 1）で、増減モードが「変えない」なら、語彙更新は動かさない。
// 「増やす」に切り替えると動き始める（04-vocab-size-mode.md）。
export function isPausedAtBaseline(mode: VocabSizeMode, activeVocabVersion: number): boolean {
  return mode === "keep" && activeVocabVersion <= 1;
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
    recordOpsEvent({
      language: update.language,
      source: "vocab_update",
      referenceId: update.id,
      message: `語彙更新 ${update.id}：${result.outcome === "applied" ? "反映した" : "見送った"}。${result.outcomeReason}（約 ${(result.costUsd * vocabOpsSettings.yenPerUsd).toFixed(1)} 円）`,
      detail: { step: "result" },
    });
    return { update, result };
  } catch (error) {
    const costUsd = spentUsd + (error instanceof CostLimitError ? error.costUsd : 0);
    const reason = error instanceof Error ? error.message : String(error);
    failVocabUpdate(db, update.id, reason, costUsd);
    recordOpsEvent({
      language: update.language,
      source: "vocab_update",
      referenceId: update.id,
      message: `語彙更新 ${update.id}：失敗した。${reason}`,
      detail: { step: "result" },
    });
    return { update, result: null };
  }
}

// 語彙更新1回の流れ（vocab-ops/README.md）。
// addCost は使った費用を足し、ここまでの合計（ドル）を返す。
async function runVocabUpdate(update: ClaimedVocabUpdate, addCost: (costUsd: number) => number): Promise<VocabUpdateResult> {
  const db = getDatabase();
  const settings = vocabOpsSettings;
  const limitUsd = settings.maxCostYen / settings.yenPerUsd;
  // Ops の画面のための記録。step は、どのステップが終わったときの記録か（ステップごとの所要時間を出すのに使う）
  const log = (step: VocabUpdateStep, message: string) =>
    recordOpsEvent({ language: update.language, source: "vocab_update", referenceId: update.id, message: `語彙更新 ${update.id}：${message}`, detail: { step } });

  // 1. 増減モードと語彙更新の幅、今の手札語彙（この語彙更新では、最後までこの手札語彙を元にする）
  const { vocabSizeMode, vocabUpdateSize } = getLanguageStatus(update.language);
  const snapshot = getVocabSnapshot(update.language);
  setVocabUpdateContext(db, update.id, {
    vocabSizeMode,
    versionBefore: snapshot.version,
    model: vocabOpsModel,
    promptVersion: vocabOpsPromptVersion,
    settingsJson: JSON.stringify({ ...settings, vocabUpdateSize }),
  });
  log(
    "start",
    `開始（増減モード ${vocabSizeMode}・語彙更新の幅 ${vocabUpdateSize}・手札語彙 版 ${snapshot.version}・${snapshot.activeWords.length} 語）`,
  );

  // 2. 追加候補と削除候補
  const additionCandidates = countAdditionCandidates(update.language, settings.additionWindow);
  log(
    "additions",
    `直近 ${settings.additionWindow} 件の拡張語彙文から、追加候補を ${additionCandidates.length} 語数えた` +
      (additionCandidates.length > 0 ? `（${additionCandidates.slice(0, 8).map((candidate) => `${candidate.lemma} ${candidate.occurrences}回`).join("、")}${additionCandidates.length > 8 ? "…" : ""}）` : ""),
  );
  // 削除候補は LLM を使わずに出せるので、先に出しておく（「変えない」「減らす」で削除候補がなければ、LLM の順位付けを飛ばすため）
  const removalCandidates = findRemovalCandidates({
    activeWords: snapshot.activeWords,
    doneSeqs: listDoneSeqs(update.language),
    usages: listActiveWordUsages(update.language),
    minGenerationsSinceAdded: settings.removalMinGenerationsSinceAdded,
    recentWindow: settings.removalRecentWindow,
    maxRecentUses: settings.removalMaxRecentUses,
  });
  // 足す語を選ぶのは「増やす」と、削除候補がある「変えない」だけ。それ以外では、費用のかかる順位付けはしない
  const rankingNeeded =
    additionCandidates.length > 0 && (vocabSizeMode === "increase" || (vocabSizeMode === "keep" && removalCandidates.length > 0));
  const ranking = rankingNeeded
    ? await rankAdditionCandidates(update.language, additionCandidates, snapshot.activeWords)
    : { ranked: [], costUsd: 0 };
  addCost(ranking.costUsd);
  if (additionCandidates.length === 0) {
    log("ranking", "追加候補がないので、LLM の順位付けは飛ばした");
  } else if (!rankingNeeded) {
    log(
      "ranking",
      vocabSizeMode === "decrease"
        ? "「減らす」モードでは語を足さないので、LLM の順位付けは飛ばした"
        : "削除候補がなく、「変えない」モードでは語を足せないので、LLM の順位付けは飛ばした",
    );
  } else {
    const lemmaOf = (wordId: number) => additionCandidates.find((candidate) => candidate.wordId === wordId)?.lemma ?? String(wordId);
    log(
      "ranking",
      `LLM が追加候補に順位を付けた：${ranking.ranked.map((item, index) => `${index + 1}. ${lemmaOf(item.wordId)}`).join("、") || "（足す価値がある語なし）"}` +
        `（順位に入らなかった語 ${additionCandidates.length - ranking.ranked.length}）`,
    );
  }

  log(
    "removals",
    `削除候補を判定した：${removalCandidates.length} 語` +
      (removalCandidates.length > 0 ? `（${removalCandidates.slice(0, 8).map((candidate) => candidate.lemma).join("、")}${removalCandidates.length > 8 ? "…" : ""}）` : ""),
  );

  // 3. 増減モードに合わせた更新案
  const proposal = buildProposal(
    vocabSizeMode,
    ranking.ranked.map((item) => item.wordId),
    removalCandidates.map((candidate) => candidate.wordId),
    vocabUpdateSize,
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

  const proposalWords = getWordsByIds([...proposal.additions, ...proposal.removals]);
  const lemmaOfWord = (wordId: number) => proposalWords.find((word) => word.id === wordId)?.lemma ?? String(wordId);
  log(
    "proposal",
    `更新案：足す ${proposal.additions.map(lemmaOfWord).join("、") || "なし"}／外す ${proposal.removals.map(lemmaOfWord).join("、") || "なし"}`,
  );

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
      changedWordIds: [...proposal.additions, ...proposal.removals],
      proposedSnapshot: createVocabSnapshot(
        update.language,
        snapshot.version,
        snapshot.expandedOutsideWordLimit,
        proposedActiveWords,
        snapshot.uncountedWords,
      ),
      spentUsd: addCost(0),
      limitUsd,
      onProgress: (message) => log("validation", message),
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
