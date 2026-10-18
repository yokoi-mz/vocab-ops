import { getDatabase } from "@/shared/db";
import {
  findWordsByIds,
  listActiveVocabVersions,
  listLanguageCodes,
  listWordsByStatus,
  type VocabWord,
} from "./vocabulary-repository";

export type Vocabulary = {
  activeVocab: VocabWord[];
  uncountedVocab: VocabWord[];
};

export function getVocabulary(language: string): Vocabulary {
  const db = getDatabase();
  return {
    activeVocab: listWordsByStatus(db, language, "active"),
    uncountedVocab: listWordsByStatus(db, language, "uncounted"),
  };
}

export function listImportedLanguages(): string[] {
  return listLanguageCodes(getDatabase());
}

export function getWordsByIds(ids: number[]): VocabWord[] {
  return findWordsByIds(getDatabase(), ids);
}

export type ActiveVocabSizePoint = {
  version: number;
  generationSeq: number;
  // その版の手札語彙の語数
  size: number;
  added: number;
  removed: number;
};

// 手札語彙の語数の移り変わり（版ごと）。出入りの履歴を古い順に足し引きして求める。
export function getActiveVocabSizeHistory(language: string): ActiveVocabSizePoint[] {
  let size = 0;
  return listActiveVocabVersions(getDatabase(), language).map((version) => {
    size += version.added - version.removed;
    return { version: version.version, generationSeq: version.generationSeq, size, added: version.added, removed: version.removed };
  });
}
