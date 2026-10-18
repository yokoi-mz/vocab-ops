import { getDatabase } from "@/shared/db";
import {
  getLanguageState,
  insertActiveVocabChange,
  markVocabUpdateStarted,
  moveWordToActive,
  moveWordToOutside,
  setActiveVocabVersion,
  setVocabSizeMode,
  type LanguageState,
  type VocabSizeMode,
} from "./vocabulary-repository";

export type VocabChangeRequest = {
  wordId: number;
  reason: string;
};

export type ApplyVocabUpdateResult = { applied: true; version: number } | { applied: false; reason: string };

// 語彙更新の結果を、手札語彙に反映する（01-architecture.md の「手札語彙の一貫性」）。
// 語の状態の変更、出入りの履歴の追加、手札語彙の版を進めることを、1つのトランザクションの中でまとめて行う。
// 語彙更新を始めたときの版（expectedVersion）から手札語彙が変わっていたら、何もせずに見送る。
export function applyVocabUpdate(
  language: string,
  vocabUpdateId: number,
  expectedVersion: number,
  additions: VocabChangeRequest[],
  removals: VocabChangeRequest[],
): ApplyVocabUpdateResult {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const state = getLanguageState(db, language);
    if (state.activeVocabVersion !== expectedVersion) {
      db.exec("ROLLBACK");
      return { applied: false, reason: `語彙更新の途中で、手札語彙が版 ${expectedVersion} から版 ${state.activeVocabVersion} に変わっていた` };
    }
    const version = state.activeVocabVersion + 1;
    const record = (wordId: number, change: "added" | "removed", reason: string) =>
      insertActiveVocabChange(db, {
        wordId,
        language,
        change,
        version,
        generationSeq: state.lastGenerationSeq,
        source: "vocab_update",
        vocabUpdateId,
        reason,
      });

    for (const addition of additions) {
      if (!moveWordToActive(db, addition.wordId, version, state.lastGenerationSeq)) {
        throw new Error(`語 ${addition.wordId} は手札外語彙ではないので、手札語彙に足せません。`);
      }
      record(addition.wordId, "added", addition.reason);
    }
    for (const removal of removals) {
      if (!moveWordToOutside(db, removal.wordId)) {
        throw new Error(`語 ${removal.wordId} は手札語彙ではないので、外せません。`);
      }
      record(removal.wordId, "removed", removal.reason);
    }
    setActiveVocabVersion(db, language, version);
    db.exec("COMMIT");
    return { applied: true, version };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getLanguageStatus(language: string): LanguageState {
  return getLanguageState(getDatabase(), language);
}

export function changeVocabSizeMode(language: string, mode: VocabSizeMode): void {
  setVocabSizeMode(getDatabase(), language, mode);
}

// 語彙更新を始めたことを記録し、その時点の文生成の通し番号を返す。
export function recordVocabUpdateStart(language: string): number {
  return markVocabUpdateStarted(getDatabase(), language);
}
