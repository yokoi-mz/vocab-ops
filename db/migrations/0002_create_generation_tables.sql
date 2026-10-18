CREATE TABLE generations (
  id INTEGER PRIMARY KEY,
  language TEXT NOT NULL REFERENCES languages (code),
  seq INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  message TEXT NOT NULL,
  situation TEXT,
  speaker TEXT NOT NULL CHECK (speaker IN ('female', 'male')),
  active_vocab_version INTEGER,
  model TEXT,
  prompt_version TEXT,
  expanded_outside_word_limit INTEGER,
  cost_usd REAL,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  started_at TEXT,
  finished_at TEXT,
  UNIQUE (language, seq)
) STRICT;

CREATE INDEX generations_status ON generations (status, id);

CREATE TABLE generation_sentences (
  id INTEGER PRIMARY KEY,
  generation_id INTEGER NOT NULL REFERENCES generations (id),
  sentence_type TEXT NOT NULL CHECK (sentence_type IN ('current_set', 'expanded_set')),
  sentence TEXT NOT NULL,
  translation TEXT NOT NULL,
  comment TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  unresolved_problems_json TEXT,
  UNIQUE (generation_id, sentence_type)
) STRICT;

CREATE TABLE generation_tokens (
  id INTEGER PRIMARY KEY,
  sentence_id INTEGER NOT NULL REFERENCES generation_sentences (id),
  position INTEGER NOT NULL,
  surface TEXT NOT NULL,
  word_id INTEGER REFERENCES words (id),
  lemma TEXT NOT NULL,
  meaning TEXT,
  part_of_speech TEXT,
  judgement TEXT NOT NULL
    CHECK (judgement IN ('active', 'uncounted', 'outside', 'proper_or_number')),
  UNIQUE (sentence_id, position)
) STRICT;

CREATE INDEX generation_tokens_word ON generation_tokens (word_id);
