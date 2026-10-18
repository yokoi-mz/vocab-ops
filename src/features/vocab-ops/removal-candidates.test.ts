import assert from "node:assert/strict";
import { test } from "node:test";
import { findRemovalCandidates } from "./removal-candidates";

const doneSeqs = Array.from({ length: 100 }, (_, index) => index + 1);
const settings = { minGenerationsSinceAdded: 90, recentWindow: 60, maxRecentUses: 0 };

test("手札語彙に入ってから十分な回数があり、直近で使われていない語は、削除候補になる", () => {
  const [candidate] = findRemovalCandidates({
    ...settings,
    activeWords: [{ id: 1, lemma: "worry", addedGenerationSeq: 0 }],
    doneSeqs,
    usages: [{ wordId: 1, seq: 10 }],
  });
  assert.deepEqual(candidate.evidence, { generationsSinceAdded: 100, totalUses: 1, recentUses: 0, generationsSinceLastUse: 90 });
});

test("直近で使われている語は、削除候補にならない", () => {
  const candidates = findRemovalCandidates({
    ...settings,
    activeWords: [{ id: 1, lemma: "go", addedGenerationSeq: 0 }],
    doneSeqs,
    usages: [{ wordId: 1, seq: 95 }],
  });
  assert.deepEqual(candidates, []);
});

test("手札語彙に入ってからの回数が足りない語は、削除候補にならない（再び入った語は0から数え直す）", () => {
  const candidates = findRemovalCandidates({
    ...settings,
    activeWords: [{ id: 1, lemma: "chiedere", addedGenerationSeq: 50 }],
    doneSeqs,
    usages: [],
  });
  assert.deepEqual(candidates, []);
});

test("手札語彙に入る前の使用は数えない", () => {
  const [candidate] = findRemovalCandidates({
    ...settings,
    minGenerationsSinceAdded: 0,
    activeWords: [{ id: 1, lemma: "chiedere", addedGenerationSeq: 50 }],
    doneSeqs,
    usages: [{ wordId: 1, seq: 45 }],
  });
  assert.equal(candidate.evidence.totalUses, 0);
});

test("削除された文生成（欠番）は数えない", () => {
  const [candidate] = findRemovalCandidates({
    ...settings,
    activeWords: [{ id: 1, lemma: "worry", addedGenerationSeq: 0 }],
    doneSeqs: doneSeqs.filter((seq) => seq % 10 !== 0),
    usages: [],
  });
  assert.equal(candidate.evidence.generationsSinceAdded, 90);
});

test("最後に使われてからの回数が多い順に並べる", () => {
  const candidates = findRemovalCandidates({
    ...settings,
    activeWords: [
      { id: 1, lemma: "a", addedGenerationSeq: 0 },
      { id: 2, lemma: "b", addedGenerationSeq: 0 },
    ],
    doneSeqs,
    usages: [
      { wordId: 1, seq: 30 },
      { wordId: 2, seq: 5 },
    ],
  });
  assert.deepEqual(
    candidates.map((candidate) => candidate.lemma),
    ["b", "a"],
  );
});
