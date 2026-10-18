import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const languageRowSchema = z.object({
  active_vocab_version: z.number(),
  last_generation_seq: z.number(),
});

export type LanguageState = {
  activeVocabVersion: number;
  lastGenerationSeq: number;
};

export function insertLanguageIfMissing(db: DatabaseSync, language: string): void {
  db.prepare("INSERT INTO languages (code) VALUES (?) ON CONFLICT (code) DO NOTHING").run(language);
}

export function getLanguageState(db: DatabaseSync, language: string): LanguageState {
  const row = languageRowSchema.parse(
    db.prepare("SELECT active_vocab_version, last_generation_seq FROM languages WHERE code = ?").get(language),
  );
  return {
    activeVocabVersion: row.active_vocab_version,
    lastGenerationSeq: row.last_generation_seq,
  };
}

export function setActiveVocabVersion(db: DatabaseSync, language: string, version: number): void {
  db.prepare("UPDATE languages SET active_vocab_version = ? WHERE code = ?").run(version, language);
}

const insertedIdSchema = z.object({ id: z.number() });

export type WordToSave = {
  language: string;
  lemma: string;
  lemmaKey: string;
  meaning: string | null;
  partOfSpeech: string | null;
  vocabStatus: "active" | "uncounted" | "outside";
  addedVersion: number | null;
  addedGenerationSeq: number | null;
};

export function saveWord(db: DatabaseSync, word: WordToSave): number {
  const row = insertedIdSchema.parse(
    db.prepare(`
      INSERT INTO words (language, lemma, lemma_key, meaning, part_of_speech, vocab_status, added_version, added_generation_seq)
      VALUES (:language, :lemma, :lemmaKey, :meaning, :partOfSpeech, :vocabStatus, :addedVersion, :addedGenerationSeq)
      ON CONFLICT (language, lemma_key) DO UPDATE SET
        lemma = excluded.lemma,
        meaning = excluded.meaning,
        part_of_speech = excluded.part_of_speech,
        vocab_status = excluded.vocab_status,
        added_version = excluded.added_version,
        added_generation_seq = excluded.added_generation_seq
      RETURNING id
    `).get(word),
  );
  return row.id;
}

export function markUncountedWordsAsOutside(db: DatabaseSync, language: string): void {
  db.prepare("UPDATE words SET vocab_status = 'outside' WHERE language = ? AND vocab_status = 'uncounted'").run(language);
}

export type ActiveVocabChange = {
  wordId: number;
  language: string;
  change: "added" | "removed";
  version: number;
  generationSeq: number;
  source: "baseline_import" | "vocab_update";
  reason: string | null;
};

export function insertActiveVocabChange(db: DatabaseSync, change: ActiveVocabChange): void {
  db.prepare(`
    INSERT INTO active_vocab_changes (word_id, language, change, version, generation_seq, source, reason)
    VALUES (:wordId, :language, :change, :version, :generationSeq, :source, :reason)
  `).run(change);
}
