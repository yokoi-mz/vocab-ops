import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { TokenJudgement } from "@/features/language";

export type Speaker = "female" | "male";
export type GenerationStatus = "pending" | "running" | "done" | "failed";
export type SentenceType = "current_set" | "expanded_set";

const now = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";

// ---- 依頼を書く・取り出す ----

export type GenerationRequest = {
  language: string;
  seq: number;
  message: string;
  situation: string | null;
  speaker: Speaker;
};

export function insertGeneration(db: DatabaseSync, request: GenerationRequest): number {
  const row = z.object({ id: z.number() }).parse(
    db.prepare(`
      INSERT INTO generations (language, seq, message, situation, speaker)
      VALUES (:language, :seq, :message, :situation, :speaker)
      RETURNING id
    `).get(request),
  );
  return row.id;
}

const claimedGenerationRowSchema = z.object({
  id: z.number(),
  language: z.string(),
  seq: z.number(),
  message: z.string(),
  situation: z.string().nullable(),
  speaker: z.enum(["female", "male"]),
});

export type ClaimedGeneration = GenerationRequest & { id: number };

// 待ち（pending）の文生成のうち、いちばん古いものを1件「実行中」にして返す。なければ undefined。
export function claimNextPendingGeneration(db: DatabaseSync): ClaimedGeneration | undefined {
  const row = db.prepare(`
    UPDATE generations SET status = 'running', started_at = ${now}
    WHERE id = (SELECT id FROM generations WHERE status = 'pending' ORDER BY id LIMIT 1)
    RETURNING id, language, seq, message, situation, speaker
  `).get();
  return row === undefined ? undefined : claimedGenerationRowSchema.parse(row);
}

// ワーカーが途中で止まったときに「実行中」のまま残った文生成を、待ちに戻す。
export function resetRunningGenerations(db: DatabaseSync): void {
  db.prepare("UPDATE generations SET status = 'pending', started_at = NULL WHERE status = 'running'").run();
}

// ---- 結果を書く ----

export type GenerationContext = {
  activeVocabVersion: number;
  model: string;
  promptVersion: string;
  expandedOutsideWordLimit: number;
};

export function setGenerationContext(db: DatabaseSync, id: number, context: GenerationContext): void {
  db.prepare(`
    UPDATE generations SET
      active_vocab_version = :activeVocabVersion,
      model = :model,
      prompt_version = :promptVersion,
      expanded_outside_word_limit = :expandedOutsideWordLimit
    WHERE id = :id
  `).run({ id, ...context });
}

export type SentenceToSave = {
  generationId: number;
  sentenceType: SentenceType;
  sentence: string;
  translation: string;
  comment: string;
  attempts: number;
  unresolvedProblemsJson: string | null;
};

export function insertSentence(db: DatabaseSync, sentence: SentenceToSave): number {
  const row = z.object({ id: z.number() }).parse(
    db.prepare(`
      INSERT INTO generation_sentences (generation_id, sentence_type, sentence, translation, comment, attempts, unresolved_problems_json)
      VALUES (:generationId, :sentenceType, :sentence, :translation, :comment, :attempts, :unresolvedProblemsJson)
      RETURNING id
    `).get(sentence),
  );
  return row.id;
}

export type TokenToSave = {
  sentenceId: number;
  position: number;
  surface: string;
  wordId: number | null;
  lemma: string;
  meaning: string | null;
  partOfSpeech: string | null;
  judgement: TokenJudgement;
};

export function insertToken(db: DatabaseSync, token: TokenToSave): void {
  db.prepare(`
    INSERT INTO generation_tokens (sentence_id, position, surface, word_id, lemma, meaning, part_of_speech, judgement)
    VALUES (:sentenceId, :position, :surface, :wordId, :lemma, :meaning, :partOfSpeech, :judgement)
  `).run(token);
}

export function finishGeneration(db: DatabaseSync, id: number, costUsd: number): void {
  db.prepare(`UPDATE generations SET status = 'done', cost_usd = ?, finished_at = ${now} WHERE id = ?`).run(costUsd, id);
}

export function failGeneration(db: DatabaseSync, id: number, error: string, costUsd: number): void {
  db.prepare(`UPDATE generations SET status = 'failed', error = ?, cost_usd = ?, finished_at = ${now} WHERE id = ?`).run(
    error,
    costUsd,
    id,
  );
}

// ---- 読む ----

const generationRowSchema = z.object({
  id: z.number(),
  language: z.string(),
  seq: z.number(),
  status: z.enum(["pending", "running", "done", "failed"]),
  message: z.string(),
  situation: z.string().nullable(),
  speaker: z.enum(["female", "male"]),
  active_vocab_version: z.number().nullable(),
  model: z.string().nullable(),
  cost_usd: z.number().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
});

export type Generation = {
  id: number;
  language: string;
  seq: number;
  status: GenerationStatus;
  message: string;
  situation: string | null;
  speaker: Speaker;
  activeVocabVersion: number | null;
  model: string | null;
  costUsd: number | null;
  error: string | null;
  createdAt: string;
};

function toGeneration(row: unknown): Generation {
  const generation = generationRowSchema.parse(row);
  return {
    id: generation.id,
    language: generation.language,
    seq: generation.seq,
    status: generation.status,
    message: generation.message,
    situation: generation.situation,
    speaker: generation.speaker,
    activeVocabVersion: generation.active_vocab_version,
    model: generation.model,
    costUsd: generation.cost_usd,
    error: generation.error,
    createdAt: generation.created_at,
  };
}

const generationColumns =
  "id, language, seq, status, message, situation, speaker, active_vocab_version, model, cost_usd, error, created_at";

export function findGeneration(db: DatabaseSync, id: number): Generation | undefined {
  const row = db.prepare(`SELECT ${generationColumns} FROM generations WHERE id = ?`).get(id);
  return row === undefined ? undefined : toGeneration(row);
}

export function listGenerations(db: DatabaseSync, language: string, limit: number): Generation[] {
  return db
    .prepare(`SELECT ${generationColumns} FROM generations WHERE language = ? ORDER BY seq DESC LIMIT ?`)
    .all(language, limit)
    .map(toGeneration);
}

const sentenceRowSchema = z.object({
  id: z.number(),
  sentence_type: z.enum(["current_set", "expanded_set"]),
  sentence: z.string(),
  translation: z.string(),
  comment: z.string(),
  attempts: z.number(),
  unresolved_problems_json: z.string().nullable(),
});

const tokenRowSchema = z.object({
  sentence_id: z.number(),
  surface: z.string(),
  word_id: z.number().nullable(),
  lemma: z.string(),
  meaning: z.string().nullable(),
  part_of_speech: z.string().nullable(),
  judgement: z.enum(["active", "uncounted", "outside", "proper_or_number"]),
});

export type GeneratedToken = {
  surface: string;
  wordId: number | null;
  lemma: string;
  meaning: string | null;
  partOfSpeech: string | null;
  judgement: TokenJudgement;
};

export type GeneratedSentence = {
  sentenceType: SentenceType;
  sentence: string;
  translation: string;
  comment: string;
  attempts: number;
  unresolvedProblemsJson: string | null;
  tokens: GeneratedToken[];
};

export function listSentences(db: DatabaseSync, generationId: number): GeneratedSentence[] {
  const sentences = db
    .prepare(`
      SELECT id, sentence_type, sentence, translation, comment, attempts, unresolved_problems_json
      FROM generation_sentences WHERE generation_id = ? ORDER BY sentence_type
    `)
    .all(generationId)
    .map((row) => sentenceRowSchema.parse(row));
  const tokens = db
    .prepare(`
      SELECT t.sentence_id, t.surface, t.word_id, t.lemma, t.meaning, t.part_of_speech, t.judgement
      FROM generation_tokens t JOIN generation_sentences s ON s.id = t.sentence_id
      WHERE s.generation_id = ? ORDER BY t.sentence_id, t.position
    `)
    .all(generationId)
    .map((row) => tokenRowSchema.parse(row));

  return sentences.map((sentence) => ({
    sentenceType: sentence.sentence_type,
    sentence: sentence.sentence,
    translation: sentence.translation,
    comment: sentence.comment,
    attempts: sentence.attempts,
    unresolvedProblemsJson: sentence.unresolved_problems_json,
    tokens: tokens
      .filter((token) => token.sentence_id === sentence.id)
      .map((token) => ({
        surface: token.surface,
        wordId: token.word_id,
        lemma: token.lemma,
        meaning: token.meaning,
        partOfSpeech: token.part_of_speech,
        judgement: token.judgement,
      })),
  }));
}
