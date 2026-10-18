import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeLemma } from "./normalize-lemma";

for (const [input, expected] of [
  ["Go", "go"],
  ["C’est", "c'est"],
  ["  excuse   me ", "excuse me"],
  ["Lieblings-", "lieblings"],
  ["¿Qué?", "qué"],
]) {
  test(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
    assert.equal(normalizeLemma(input), expected);
  });
}
