import { getDatabase } from "@/shared/db";
import { listLanguageCodes, listWordsByStatus, type VocabWord } from "./vocabulary-repository";

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
