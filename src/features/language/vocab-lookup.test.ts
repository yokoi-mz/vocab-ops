import assert from "node:assert/strict";
import { test } from "node:test";
import { createVocabLookup, judgeToken } from "./vocab-lookup";

const frenchLookup = createVocabLookup("fr", [
  { wordId: 1, lemma: "je", status: "uncounted" },
  { wordId: 2, lemma: "vivre", status: "active" },
  { wordId: 3, lemma: "avoir besoin de", status: "active" },
  { wordId: 4, lemma: "de", status: "uncounted" },
  { wordId: 5, lemma: "souvenir", status: "active" },
]);

test("固有名詞は、固有名詞・数字と判定する", () => {
  assert.equal(judgeToken(frenchLookup, { kind: "proper_noun", surface: "Italie", lemma: "Italie" }).judgement, "proper_or_number");
});

test("数字で書かれた数は、固有名詞・数字と判定する", () => {
  assert.equal(judgeToken(frenchLookup, { kind: "number", surface: "6", lemma: "6" }).judgement, "proper_or_number");
});

test("文字で書かれた数は、普通の語として判定する", () => {
  assert.equal(judgeToken(frenchLookup, { kind: "number", surface: "six", lemma: "six" }).judgement, "outside");
});

test("J' の辞書形 je は、ノーカン語彙と判定する", () => {
  assert.deepEqual(judgeToken(frenchLookup, { kind: "word", surface: "J'", lemma: "je" }), {
    judgement: "uncounted",
    wordId: 1,
  });
});

test("大文字で書かれた辞書形も、手札語彙と判定する", () => {
  assert.equal(judgeToken(frenchLookup, { kind: "word", surface: "Vécu", lemma: "Vivre" }).judgement, "active");
});

test("複数語の見出しは、構成する語でも手札語彙と判定する", () => {
  assert.deepEqual(judgeToken(frenchLookup, { kind: "word", surface: "besoin", lemma: "besoin" }), {
    judgement: "active",
    wordId: 3,
  });
});

test("構成する語が別の見出しでもあるときは、その見出しを優先する", () => {
  assert.equal(judgeToken(frenchLookup, { kind: "word", surface: "de", lemma: "de" }).wordId, 4);
});

test("再帰動詞の se を外して、手札語彙と判定する", () => {
  assert.equal(judgeToken(frenchLookup, { kind: "word", surface: "souviens", lemma: "se souvenir" }).judgement, "active");
});

test("イタリア語の -arsi を -are にして、手札語彙と判定する", () => {
  const lookup = createVocabLookup("it", [{ wordId: 1, lemma: "preoccupare", status: "active" }]);
  assert.equal(judgeToken(lookup, { kind: "word", surface: "preoccupo", lemma: "preoccuparsi" }).judgement, "active");
});
