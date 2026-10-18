CREATE TABLE languages (
  code TEXT PRIMARY KEY,
  vocab_size_mode TEXT NOT NULL DEFAULT 'increase'
    CHECK (vocab_size_mode IN ('increase', 'keep', 'decrease')),
  voice_name TEXT,
  expanded_outside_word_limit INTEGER NOT NULL DEFAULT 5,
  active_vocab_version INTEGER NOT NULL DEFAULT 0,
  last_generation_seq INTEGER NOT NULL DEFAULT 0,
  last_vocab_update_seq INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE words (
  id INTEGER PRIMARY KEY,
  language TEXT NOT NULL REFERENCES languages (code),
  lemma TEXT NOT NULL,
  lemma_key TEXT NOT NULL,
  meaning TEXT,
  part_of_speech TEXT,
  vocab_status TEXT NOT NULL
    CHECK (vocab_status IN ('active', 'uncounted', 'outside')),
  added_version INTEGER,
  added_generation_seq INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (language, lemma_key)
) STRICT;

CREATE TABLE active_vocab_changes (
  id INTEGER PRIMARY KEY,
  word_id INTEGER NOT NULL REFERENCES words (id),
  language TEXT NOT NULL REFERENCES languages (code),
  change TEXT NOT NULL CHECK (change IN ('added', 'removed')),
  version INTEGER NOT NULL,
  generation_seq INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('baseline_import', 'vocab_update')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;
