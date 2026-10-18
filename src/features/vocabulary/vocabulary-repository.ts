import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";

const languageRowSchema = z.object({
  voice_name: z.string().nullable(),
  vocab_size_mode: z.enum(["increase", "keep", "decrease"]),
  expanded_outside_word_limit: z.number(),
  active_vocab_version: z.number(),
  last_generation_seq: z.number(),
  last_vocab_update_seq: z.number(),
});

export type VocabSizeMode = "increase" | "keep" | "decrease";

export type LanguageState = {
  // 読み上げに使う声の名前。null なら自動で選ぶ
  voiceName: string | null;
  vocabSizeMode: VocabSizeMode;
  expandedOutsideWordLimit: number;
  activeVocabVersion: number;
  lastGenerationSeq: number;
  lastVocabUpdateSeq: number;
};

export function insertLanguageIfMissing(db: DatabaseSync, language: string): void {
  db.prepare("INSERT INTO languages (code) VALUES (?) ON CONFLICT (code) DO NOTHING").run(language);
}

export function getLanguageState(db: DatabaseSync, language: string): LanguageState {
  const row = languageRowSchema.parse(
    db.prepare(`
      SELECT voice_name, vocab_size_mode, expanded_outside_word_limit, active_vocab_version, last_generation_seq, last_vocab_update_seq
      FROM languages WHERE code = ?
    `).get(language),
  );
  return {
    voiceName: row.voice_name,
    vocabSizeMode: row.vocab_size_mode,
    expandedOutsideWordLimit: row.expanded_outside_word_limit,
    activeVocabVersion: row.active_vocab_version,
    lastGenerationSeq: row.last_generation_seq,
    lastVocabUpdateSeq: row.last_vocab_update_seq,
  };
}

export function advanceGenerationSeq(db: DatabaseSync, language: string): number {
  const row = z.object({ last_generation_seq: z.number() }).parse(
    db.prepare("UPDATE languages SET last_generation_seq = last_generation_seq + 1 WHERE code = ? RETURNING last_generation_seq").get(language),
  );
  return row.last_generation_seq;
}

export function setActiveVocabVersion(db: DatabaseSync, language: string, version: number): void {
  db.prepare("UPDATE languages SET active_vocab_version = ? WHERE code = ?").run(version, language);
}

const insertedIdSchema = z.object({ id: z.number() });

export type VocabStatus = "active" | "uncounted" | "outside";

export type WordToSave = {
  language: string;
  lemma: string;
  lemmaKey: string;
  meaning: string | null;
  partOfSpeech: string | null;
  vocabStatus: VocabStatus;
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
  vocabUpdateId: number | null;
  reason: string | null;
};

export function insertActiveVocabChange(db: DatabaseSync, change: ActiveVocabChange): void {
  db.prepare(`
    INSERT INTO active_vocab_changes (word_id, language, change, version, generation_seq, source, vocab_update_id, reason)
    VALUES (:wordId, :language, :change, :version, :generationSeq, :source, :vocabUpdateId, :reason)
  `).run(change);
}

// 手札外語彙の語を、手札語彙に入れる。今が手札外語彙でなければ何もせず false を返す。
export function moveWordToActive(db: DatabaseSync, wordId: number, version: number, generationSeq: number): boolean {
  const result = db
    .prepare(`
      UPDATE words SET vocab_status = 'active', added_version = ?, added_generation_seq = ?
      WHERE id = ? AND vocab_status = 'outside'
    `)
    .run(version, generationSeq, wordId);
  return result.changes === 1;
}

// 手札語彙の語を、手札外語彙に戻す。今が手札語彙でなければ何もせず false を返す。
export function moveWordToOutside(db: DatabaseSync, wordId: number): boolean {
  const result = db
    .prepare(`
      UPDATE words SET vocab_status = 'outside', added_version = NULL, added_generation_seq = NULL
      WHERE id = ? AND vocab_status = 'active'
    `)
    .run(wordId);
  return result.changes === 1;
}

export type LanguageSettings = {
  voiceName: string | null;
  vocabSizeMode: VocabSizeMode;
  expandedOutsideWordLimit: number;
};

// 言語の設定のうち、渡されたものだけを書き換える。
export function updateLanguageSettings(db: DatabaseSync, language: string, settings: Partial<LanguageSettings>): void {
  const columns: [keyof LanguageSettings, string][] = [
    ["voiceName", "voice_name"],
    ["vocabSizeMode", "vocab_size_mode"],
    ["expandedOutsideWordLimit", "expanded_outside_word_limit"],
  ];
  for (const [key, column] of columns) {
    if (settings[key] !== undefined) {
      db.prepare(`UPDATE languages SET ${column} = ? WHERE code = ?`).run(settings[key], language);
    }
  }
}

// 語彙更新を始めたことを記録する。その時点の文生成の通し番号を返す。
export function markVocabUpdateStarted(db: DatabaseSync, language: string): number {
  return z.object({ last_vocab_update_seq: z.number() }).parse(
    db.prepare(`
      UPDATE languages SET last_vocab_update_seq = last_generation_seq WHERE code = ?
      RETURNING last_vocab_update_seq
    `).get(language),
  ).last_vocab_update_seq;
}

const lemmaKeyRowSchema = z.object({ lemma_key: z.string() });

export function listActiveLemmaKeys(db: DatabaseSync, language: string): Set<string> {
  const rows = db.prepare("SELECT lemma_key FROM words WHERE language = ? AND vocab_status = 'active'").all(language);
  return new Set(rows.map((row) => lemmaKeyRowSchema.parse(row).lemma_key));
}

const languageCodeRowSchema = z.object({ code: z.string() });

export function listLanguageCodes(db: DatabaseSync): string[] {
  const rows = db.prepare("SELECT code FROM languages ORDER BY code").all();
  return rows.map((row) => languageCodeRowSchema.parse(row).code);
}

const wordRowSchema = z.object({
  id: z.number(),
  lemma: z.string(),
  meaning: z.string().nullable(),
  part_of_speech: z.string().nullable(),
  vocab_status: z.enum(["active", "uncounted", "outside"]),
  added_version: z.number().nullable(),
  added_generation_seq: z.number().nullable(),
});

export type VocabWord = {
  id: number;
  lemma: string;
  meaning: string | null;
  partOfSpeech: string | null;
  vocabStatus: VocabStatus;
  // 今回、手札語彙に入ったときの手札語彙の版と、文生成の通し番号（手札語彙の語だけ）
  addedVersion: number | null;
  addedGenerationSeq: number | null;
};

const wordColumns = "id, lemma, meaning, part_of_speech, vocab_status, added_version, added_generation_seq";

function toVocabWord(row: unknown): VocabWord {
  const word = wordRowSchema.parse(row);
  return {
    id: word.id,
    lemma: word.lemma,
    meaning: word.meaning,
    partOfSpeech: word.part_of_speech,
    vocabStatus: word.vocab_status,
    addedVersion: word.added_version,
    addedGenerationSeq: word.added_generation_seq,
  };
}

export function listWordsByStatus(db: DatabaseSync, language: string, vocabStatus: VocabStatus): VocabWord[] {
  return db
    .prepare(`SELECT ${wordColumns} FROM words WHERE language = ? AND vocab_status = ? ORDER BY id`)
    .all(language, vocabStatus)
    .map(toVocabWord);
}

export function findWordsByIds(db: DatabaseSync, ids: number[]): VocabWord[] {
  if (ids.length === 0) {
    return [];
  }
  return db
    .prepare(`SELECT ${wordColumns} FROM words WHERE id IN (${ids.map(() => "?").join(", ")})`)
    .all(...ids)
    .map(toVocabWord);
}

// 手札外語彙の語を登録する。すでに手札外語彙の語として登録されていれば、意味と品詞を最新の値に書き換える。
// どちらの場合も、語の番号を返す。
export function saveOutsideWord(
  db: DatabaseSync,
  word: { language: string; lemma: string; lemmaKey: string; meaning: string | null; partOfSpeech: string | null },
): number {
  db.prepare(`
    INSERT INTO words (language, lemma, lemma_key, meaning, part_of_speech, vocab_status)
    VALUES (:language, :lemma, :lemmaKey, :meaning, :partOfSpeech, 'outside')
    ON CONFLICT (language, lemma_key) DO UPDATE SET
      meaning = excluded.meaning,
      part_of_speech = excluded.part_of_speech
    WHERE vocab_status = 'outside'
  `).run(word);
  return insertedIdSchema.parse(
    db.prepare("SELECT id FROM words WHERE language = ? AND lemma_key = ?").get(word.language, word.lemmaKey),
  ).id;
}
