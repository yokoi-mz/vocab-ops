import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import type { VocabSizeMode } from "@/features/vocabulary";

export type VocabUpdateStatus = "pending" | "running" | "done" | "failed";
export type CandidateType = "addition" | "removal";
export type ValidationJudgement = "improved" | "worsened" | "same";
export type VocabUpdateOutcome = "applied" | "skipped";

const now = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";
const idSchema = z.object({ id: z.number() });

// ---- 待ちを書く・取り出す ----

export function insertVocabUpdate(db: DatabaseSync, language: string, triggerGenerationSeq: number): number {
  return idSchema.parse(
    db.prepare("INSERT INTO vocab_updates (language, trigger_generation_seq) VALUES (?, ?) RETURNING id").get(language, triggerGenerationSeq),
  ).id;
}

const claimedRowSchema = z.object({ id: z.number(), language: z.string(), trigger_generation_seq: z.number() });

export type ClaimedVocabUpdate = {
  id: number;
  language: string;
  triggerGenerationSeq: number;
};

// 待ち（pending）の語彙更新のうち、いちばん古いものを1件「実行中」にして返す。なければ undefined。
export function claimNextPendingVocabUpdate(db: DatabaseSync): ClaimedVocabUpdate | undefined {
  const row = db.prepare(`
    UPDATE vocab_updates SET status = 'running', started_at = ${now}
    WHERE id = (SELECT id FROM vocab_updates WHERE status = 'pending' ORDER BY id LIMIT 1)
    RETURNING id, language, trigger_generation_seq
  `).get();
  if (row === undefined) {
    return undefined;
  }
  const parsed = claimedRowSchema.parse(row);
  return { id: parsed.id, language: parsed.language, triggerGenerationSeq: parsed.trigger_generation_seq };
}

// ワーカーが途中で止まったときに「実行中」のまま残った語彙更新を、待ちに戻す。
// 途中まで書いた候補と検証の行は消して、最初からやり直す。
export function resetRunningVocabUpdates(db: DatabaseSync): void {
  const running = "SELECT id FROM vocab_updates WHERE status = 'running'";
  db.prepare(`DELETE FROM vocab_update_candidates WHERE vocab_update_id IN (${running})`).run();
  db.prepare(`DELETE FROM vocab_update_validations WHERE vocab_update_id IN (${running})`).run();
  db.prepare("UPDATE vocab_updates SET status = 'pending', started_at = NULL WHERE status = 'running'").run();
}

// ---- 実行中に書く ----

export type VocabUpdateContext = {
  vocabSizeMode: VocabSizeMode;
  versionBefore: number;
  model: string;
  promptVersion: string;
  settingsJson: string;
};

export function setVocabUpdateContext(db: DatabaseSync, id: number, context: VocabUpdateContext): void {
  db.prepare(`
    UPDATE vocab_updates SET
      vocab_size_mode = :vocabSizeMode,
      version_before = :versionBefore,
      model = :model,
      prompt_version = :promptVersion,
      settings_json = :settingsJson
    WHERE id = :id
  `).run({ id, ...context });
}

export type CandidateToSave = {
  vocabUpdateId: number;
  candidateType: CandidateType;
  wordId: number;
  rank: number;
  reason: string | null;
  evidenceJson: string;
  inProposal: boolean;
};

export function insertCandidate(db: DatabaseSync, candidate: CandidateToSave): void {
  db.prepare(`
    INSERT INTO vocab_update_candidates (vocab_update_id, candidate_type, word_id, rank, reason, evidence_json, in_proposal)
    VALUES (:vocabUpdateId, :candidateType, :wordId, :rank, :reason, :evidenceJson, :inProposal)
  `).run({ ...candidate, inProposal: candidate.inProposal ? 1 : 0 });
}

export type ValidationToSave = {
  vocabUpdateId: number;
  sourceGenerationId: number;
  currentSetSentence: string;
  currentSetReused: boolean;
  proposedSetSentence: string;
  presentedFirst: "current_set" | "proposed_set";
  judgement: ValidationJudgement | null;
};

export function insertValidation(db: DatabaseSync, validation: ValidationToSave): void {
  db.prepare(`
    INSERT INTO vocab_update_validations
      (vocab_update_id, source_generation_id, current_set_sentence, current_set_reused, proposed_set_sentence, presented_first, judgement)
    VALUES
      (:vocabUpdateId, :sourceGenerationId, :currentSetSentence, :currentSetReused, :proposedSetSentence, :presentedFirst, :judgement)
  `).run({ ...validation, currentSetReused: validation.currentSetReused ? 1 : 0 });
}

export type VocabUpdateResult = {
  versionAfter: number | null;
  validationPerformed: boolean;
  improvedCount: number | null;
  worsenedCount: number | null;
  sameCount: number | null;
  outcome: VocabUpdateOutcome;
  outcomeReason: string;
  costUsd: number;
};

export function finishVocabUpdate(db: DatabaseSync, id: number, result: VocabUpdateResult): void {
  db.prepare(`
    UPDATE vocab_updates SET
      status = 'done',
      version_after = :versionAfter,
      validation_performed = :validationPerformed,
      improved_count = :improvedCount,
      worsened_count = :worsenedCount,
      same_count = :sameCount,
      outcome = :outcome,
      outcome_reason = :outcomeReason,
      cost_usd = :costUsd,
      finished_at = ${now}
    WHERE id = :id
  `).run({ id, ...result, validationPerformed: result.validationPerformed ? 1 : 0 });
}

export function failVocabUpdate(db: DatabaseSync, id: number, error: string, costUsd: number): void {
  db.prepare(`UPDATE vocab_updates SET status = 'failed', error = ?, cost_usd = ?, finished_at = ${now} WHERE id = ?`).run(
    error,
    costUsd,
    id,
  );
}

// ---- 読む ----

const vocabUpdateRowSchema = z.object({
  id: z.number(),
  language: z.string(),
  status: z.enum(["pending", "running", "done", "failed"]),
  trigger_generation_seq: z.number(),
  vocab_size_mode: z.enum(["increase", "keep", "decrease"]).nullable(),
  version_before: z.number().nullable(),
  version_after: z.number().nullable(),
  validation_performed: z.number(),
  improved_count: z.number().nullable(),
  worsened_count: z.number().nullable(),
  same_count: z.number().nullable(),
  outcome: z.enum(["applied", "skipped"]).nullable(),
  outcome_reason: z.string().nullable(),
  cost_usd: z.number().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  finished_at: z.string().nullable(),
});

export type VocabUpdate = {
  id: number;
  language: string;
  status: VocabUpdateStatus;
  triggerGenerationSeq: number;
  vocabSizeMode: VocabSizeMode | null;
  versionBefore: number | null;
  versionAfter: number | null;
  validationPerformed: boolean;
  improvedCount: number | null;
  worsenedCount: number | null;
  sameCount: number | null;
  outcome: VocabUpdateOutcome | null;
  outcomeReason: string | null;
  costUsd: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export function listVocabUpdates(db: DatabaseSync, language: string, limit: number): VocabUpdate[] {
  return db
    .prepare("SELECT * FROM vocab_updates WHERE language = ? ORDER BY id DESC LIMIT ?")
    .all(language, limit)
    .map((row) => {
      const update = vocabUpdateRowSchema.parse(row);
      return {
        id: update.id,
        language: update.language,
        status: update.status,
        triggerGenerationSeq: update.trigger_generation_seq,
        vocabSizeMode: update.vocab_size_mode,
        versionBefore: update.version_before,
        versionAfter: update.version_after,
        validationPerformed: update.validation_performed === 1,
        improvedCount: update.improved_count,
        worsenedCount: update.worsened_count,
        sameCount: update.same_count,
        outcome: update.outcome,
        outcomeReason: update.outcome_reason,
        costUsd: update.cost_usd,
        error: update.error,
        createdAt: update.created_at,
        finishedAt: update.finished_at,
      };
    });
}
