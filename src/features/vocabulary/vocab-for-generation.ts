import { createVocabLookup, normalizeLemma, type VocabLookup } from "@/features/language";
import { getDatabase } from "@/shared/db";
import {
  advanceGenerationSeq,
  getLanguageState,
  listWordsByStatus,
  saveOutsideWord,
  type VocabWord,
} from "./vocabulary-repository";

// 文生成を始めるときに確定する、その時点の手札語彙とノーカン語彙（01-architecture.md の「手札語彙の一貫性」）。
export type VocabSnapshot = {
  language: string;
  version: number;
  expandedOutsideWordLimit: number;
  activeWords: VocabWord[];
  uncountedWords: VocabWord[];
  lookup: VocabLookup;
};

export function getVocabSnapshot(language: string): VocabSnapshot {
  const db = getDatabase();
  // 1つのトランザクションの中で読み、語彙更新の途中の状態を読まないようにする
  db.exec("BEGIN");
  try {
    const state = getLanguageState(db, language);
    const activeWords = listWordsByStatus(db, language, "active");
    const uncountedWords = listWordsByStatus(db, language, "uncounted");
    db.exec("COMMIT");
    return createVocabSnapshot(language, state.activeVocabVersion, state.expandedOutsideWordLimit, activeWords, uncountedWords);
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createVocabSnapshot(
  language: string,
  version: number,
  expandedOutsideWordLimit: number,
  activeWords: VocabWord[],
  uncountedWords: VocabWord[],
): VocabSnapshot {
  const lookup = createVocabLookup(language, [
    ...uncountedWords.map((word) => ({ wordId: word.id, lemma: word.lemma, status: "uncounted" as const })),
    ...activeWords.map((word) => ({ wordId: word.id, lemma: word.lemma, status: "active" as const })),
  ]);
  return { language, version, expandedOutsideWordLimit, activeWords, uncountedWords, lookup };
}

// その言語の文生成の通し番号を1つ進めて返す。
export function takeNextGenerationSeq(language: string): number {
  return advanceGenerationSeq(getDatabase(), language);
}

// 拡張語彙文に出てきた手札外語彙の語を登録し、語の番号を返す。意味と品詞は、最新の値で書き換える。
export function registerOutsideWord(
  language: string,
  word: { lemma: string; meaning: string | null; partOfSpeech: string | null },
): number {
  return saveOutsideWord(getDatabase(), { language, lemmaKey: normalizeLemma(word.lemma), ...word });
}
