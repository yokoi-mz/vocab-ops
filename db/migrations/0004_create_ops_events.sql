-- 裏で行われた動き（文生成、語彙更新、ワーカー）の記録。Ops の画面に表示する。
-- 言いたいことや作った文の中身は書かず、番号・回数・語だけを書く。
CREATE TABLE ops_events (
  id INTEGER PRIMARY KEY,
  language TEXT,
  source TEXT NOT NULL CHECK (source IN ('worker', 'generation', 'vocab_update')),
  reference_id INTEGER,
  message TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

CREATE INDEX ops_events_language ON ops_events (language, id);
