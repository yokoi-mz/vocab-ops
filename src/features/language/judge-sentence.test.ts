import assert from "node:assert/strict";
import { test } from "node:test";
import { judgeSentence } from "./judge-sentence";
import { createVocabLookup, type TokenKind } from "./vocab-lookup";

function word(surface: string, lemma: string, kind: TokenKind = "word") {
  return { surface, lemma, kind };
}

function suspiciousPairs(language: string, surface: string, lemma: string, status: "active" | "uncounted" = "active") {
  const lookup = createVocabLookup(language, [{ wordId: 1, lemma, status }]);
  const { problems } = judgeSentence(lookup, surface, [word(surface, lemma)], 0);
  return problems.filter((problem) => problem.type === "suspicious_lemmas");
}

const frenchLookup = createVocabLookup("fr", [
  { wordId: 1, lemma: "je", status: "uncounted" },
  { wordId: 2, lemma: "avoir", status: "uncounted" },
  { wordId: 3, lemma: "vivre", status: "active" },
  { wordId: 4, lemma: "en", status: "uncounted" },
]);
const frenchTokens = [
  word("J'", "je"),
  word("ai", "avoir"),
  word("vécu", "vivre"),
  word("six", "six", "number"),
  word("mois", "mois"),
  word("en", "en"),
  word("Italie", "Italie", "proper_noun"),
];

test("手札外語彙の語が上限以下なら合格", () => {
  const result = judgeSentence(frenchLookup, "J'ai vécu six mois en Italie.", frenchTokens, 2);
  assert.deepEqual(result.problems, []);
  assert.deepEqual(result.outsideLemmas, ["six", "mois"]);
});

test("句読点だけの単語は、語として扱わない", () => {
  const result = judgeSentence(frenchLookup, "J'ai vécu six mois en Italie ?", [...frenchTokens, word("?", "?")], 2);
  assert.deepEqual(result.problems, []);
  assert.equal(result.tokens.length, frenchTokens.length);
});

test("チェック A：手札外語彙の語が上限を超えたら不合格", () => {
  const result = judgeSentence(frenchLookup, "J'ai vécu six mois en Italie.", frenchTokens, 0);
  assert.deepEqual(result.problems, [{ type: "too_many_outside_words", outsideLemmas: ["six", "mois"], limit: 0 }]);
});

test("チェック B：単語の一覧に載っていない単語があれば不合格", () => {
  const tokensWithoutMois = frenchTokens.filter((token) => token.surface !== "mois");
  const result = judgeSentence(frenchLookup, "J'ai vécu six mois en Italie.", tokensWithoutMois, 5);
  assert.deepEqual(result.problems, [{ type: "missing_tokens", words: ["mois"] }]);
});

test("チェック B：J' を je と書き出していても一致とみなす", () => {
  const tokens = [word("je", "je"), ...frenchTokens.slice(1)];
  const result = judgeSentence(frenchLookup, "J'ai vécu six mois en Italie.", tokens, 5);
  assert.deepEqual(result.problems, []);
});

test("チェック B：英語の短縮形を do と n't に分けて書き出していても一致とみなす", () => {
  const lookup = createVocabLookup("en", [{ wordId: 1, lemma: "do", status: "uncounted" }]);
  const tokens = [word("I", "I"), word("do", "do"), word("n't", "not"), word("know", "know")];
  const result = judgeSentence(lookup, "I don't know.", tokens, 5);
  assert.deepEqual(
    result.problems.filter((problem) => problem.type === "missing_tokens"),
    [],
  );
});

test("チェック C：Ding → kein は疑う", () => {
  assert.equal(suspiciousPairs("de", "Ding", "kein", "uncounted").length, 1);
});

for (const [language, surface, lemma] of [
  ["fr", "suis", "être"],
  ["fr", "mieux", "bien"],
  ["de", "besser", "gut"],
  ["it", "meglio", "bene"],
  ["de", "Ihnen", "Sie"],
  ["de", "euch", "ihr"],
  ["it", "nella", "in"],
  ["en", "went", "go"],
  ["en", "were", "be"],
  ["en", "better", "good"],
  ["en", "best", "good"],
  ["en", "worse", "bad"],
  ["en", "better", "well"],
  ["en", "herself", "she"],
  ["en", "ours", "we"],
  ["en", "bought", "buy"],
  ["sv", "gick", "gå"],
  ["sv", "bättre", "bra"],
  ["sv", "honom", "han"],
  ["sv", "varit", "vara"],
] as const) {
  test(`チェック C：${surface} → ${lemma}（${language}）は疑わない`, () => {
    assert.deepEqual(suspiciousPairs(language, surface, lemma), []);
  });
}

for (const [surface, lemma] of [
  ["weekend", "week"],
  ["into", "in"],
  ["someone", "some"],
] as const) {
  test(`チェック C：${surface} → ${lemma}（en）は、別の語なので疑う`, () => {
    assert.equal(suspiciousPairs("en", surface, lemma).length, 1);
  });
}

for (const [surface, lemma] of [
  ["makes", "make"],
  ["watched", "watch"],
  ["going", "go"],
  ["stopped", "stop"],
  ["bigger", "big"],
  ["really", "real"],
  ["taken", "take"],
  ["cannot", "can"],
  ["done", "do"],
  ["gone", "go"],
  ["children", "child"],
  ["an", "a"],
] as const) {
  test(`チェック C：${surface} → ${lemma}（en）は、語形変化なので疑わない`, () => {
    assert.deepEqual(suspiciousPairs("en", surface, lemma), []);
  });
}
