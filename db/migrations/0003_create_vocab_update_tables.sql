CREATE TABLE vocab_updates (
  id INTEGER PRIMARY KEY,
  language TEXT NOT NULL REFERENCES languages (code),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  trigger_generation_seq INTEGER NOT NULL,
  vocab_size_mode TEXT CHECK (vocab_size_mode IN ('increase', 'keep', 'decrease')),
  version_before INTEGER,
  version_after INTEGER,
  validation_performed INTEGER NOT NULL DEFAULT 0 CHECK (validation_performed IN (0, 1)),
  improved_count INTEGER,
  worsened_count INTEGER,
  same_count INTEGER,
  outcome TEXT CHECK (outcome IN ('applied', 'skipped')),
  outcome_reason TEXT,
  model TEXT,
  prompt_version TEXT,
  settings_json TEXT,
  cost_usd REAL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  started_at TEXT,
  finished_at TEXT
) STRICT;

CREATE INDEX vocab_updates_status ON vocab_updates (status, id);

CREATE TABLE vocab_update_candidates (
  id INTEGER PRIMARY KEY,
  vocab_update_id INTEGER NOT NULL REFERENCES vocab_updates (id),
  candidate_type TEXT NOT NULL CHECK (candidate_type IN ('addition', 'removal')),
  word_id INTEGER NOT NULL REFERENCES words (id),
  rank INTEGER NOT NULL,
  reason TEXT,
  evidence_json TEXT,
  in_proposal INTEGER NOT NULL DEFAULT 0 CHECK (in_proposal IN (0, 1))
) STRICT;

-- 検証に使った文生成をユーザーが削除したら、その検証の行も一緒に消える（ON DELETE CASCADE）。
-- 削除された文生成の原文に近い内容を、語彙更新の記録にも残さないため。
CREATE TABLE vocab_update_validations (
  id INTEGER PRIMARY KEY,
  vocab_update_id INTEGER NOT NULL REFERENCES vocab_updates (id),
  source_generation_id INTEGER NOT NULL REFERENCES generations (id) ON DELETE CASCADE,
  current_set_sentence TEXT NOT NULL,
  current_set_reused INTEGER NOT NULL CHECK (current_set_reused IN (0, 1)),
  proposed_set_sentence TEXT NOT NULL,
  presented_first TEXT NOT NULL CHECK (presented_first IN ('current_set', 'proposed_set')),
  judgement TEXT CHECK (judgement IN ('improved', 'worsened', 'same'))
) STRICT;

ALTER TABLE active_vocab_changes ADD COLUMN vocab_update_id INTEGER REFERENCES vocab_updates (id);
