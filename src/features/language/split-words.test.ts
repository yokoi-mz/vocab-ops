import assert from "node:assert/strict";
import { test } from "node:test";
import { splitWords } from "./split-words";

test("フランス語：アポストロフィで切り、小文字にそろえる", () => {
  assert.deepEqual(splitWords("fr", "J'ai vécu six mois en Italie."), ["j", "ai", "vécu", "six", "mois", "en", "italie"]);
});

test("英語：短縮形はアポストロフィで切らない", () => {
  assert.deepEqual(splitWords("en", "I don't think we're late."), ["i", "don't", "think", "we're", "late"]);
});

test("数字も1つの単語として取り出す", () => {
  assert.deepEqual(splitWords("it", "Ho 6 anni."), ["ho", "6", "anni"]);
});
