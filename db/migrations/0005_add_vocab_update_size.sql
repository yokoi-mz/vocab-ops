-- 語彙更新の幅：1回の語彙更新で増やす・減らす語数と、入れ替える語数の上限（同じ数）。
-- 言語ごとに、設定の画面で 3・4・5 から選ぶ。今ある言語も 4 になる。
ALTER TABLE languages ADD COLUMN vocab_update_size INTEGER NOT NULL DEFAULT 4
  CHECK (vocab_update_size IN (3, 4, 5));
