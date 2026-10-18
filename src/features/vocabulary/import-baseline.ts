import { readFileSync } from "node:fs";
import path from "node:path";
import { normalizeLemma } from "@/features/language";
import { getDatabase } from "@/shared/db";
import { parseBaseline } from "./baseline-file";
import {
  getLanguageState,
  insertActiveVocabChange,
  insertLanguageIfMissing,
  markUncountedWordsAsOutside,
  saveWord,
  setActiveVocabVersion,
} from "./vocabulary-repository";

export type BaselineImportResult = {
  activeWordsImported: boolean;
  activeWordCount: number;
  uncountedWordCount: number;
};

export function importBaseline(language: string): BaselineImportResult {
  const filePath = path.join(process.cwd(), "docs", "baseline", `${language}-baseline.md`);
  const baseline = parseBaseline(readFileSync(filePath, "utf8"));
  const db = getDatabase();

  db.exec("BEGIN");
  try {
    insertLanguageIfMissing(db, language);
    const { activeVocabVersion, lastGenerationSeq } = getLanguageState(db, language);

    const activeWordsImported = activeVocabVersion === 0;
    if (activeWordsImported) {
      const version = 1;
      for (const word of baseline.activeWords) {
        const wordId = saveWord(db, {
          language,
          lemma: word.lemma,
          lemmaKey: normalizeLemma(word.lemma),
          meaning: word.meaning,
          partOfSpeech: word.partOfSpeech,
          vocabStatus: "active",
          addedVersion: version,
          addedGenerationSeq: lastGenerationSeq,
        });
        insertActiveVocabChange(db, {
          wordId,
          language,
          change: "added",
          version,
          generationSeq: lastGenerationSeq,
          source: "baseline_import",
          reason: null,
        });
      }
      setActiveVocabVersion(db, language, version);
    }

    markUncountedWordsAsOutside(db, language);
    for (const word of baseline.uncountedWords) {
      saveWord(db, {
        language,
        lemma: word.lemma,
        lemmaKey: normalizeLemma(word.lemma),
        meaning: null,
        partOfSpeech: word.partOfSpeech,
        vocabStatus: "uncounted",
        addedVersion: null,
        addedGenerationSeq: null,
      });
    }

    db.exec("COMMIT");
    return {
      activeWordsImported,
      activeWordCount: baseline.activeWords.length,
      uncountedWordCount: baseline.uncountedWords.length,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
