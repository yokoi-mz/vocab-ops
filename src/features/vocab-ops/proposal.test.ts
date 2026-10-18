import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProposal } from "./proposal";

const additions = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const removals = [21, 22, 23, 24, 25, 26, 27, 28];
const count = (proposal: { additions: number[]; removals: number[] }) => [proposal.additions.length, proposal.removals.length];

test("増やす：削除候補がなければ、＋幅（幅 3 なら ＋3）", () => {
  assert.deepEqual(count(buildProposal("increase", additions, [], 3)), [3, 0]);
});

test("増やす：削除候補があれば、−3 ＋6（差し引き ＋3）", () => {
  assert.deepEqual(buildProposal("increase", additions, removals, 3), { additions: [11, 12, 13, 14, 15, 16], removals: [21, 22, 23] });
});

test("増やす：削除候補が1語なら、−1 ＋4（差し引き ＋3）", () => {
  assert.deepEqual(count(buildProposal("increase", additions, [21], 3)), [4, 1]);
});

test("増やす：追加候補が足りなければ、差し引きがプラスのままになるように外す数を減らす", () => {
  assert.deepEqual(count(buildProposal("increase", [11, 12, 13, 14], removals, 3)), [4, 1]);
  assert.deepEqual(count(buildProposal("increase", [11, 12], removals, 3)), [2, 0]);
});

test("変えない：−3 ＋3。どちらかがなければ何もしない", () => {
  assert.deepEqual(count(buildProposal("keep", additions, removals, 3)), [3, 3]);
  assert.deepEqual(count(buildProposal("keep", additions, [], 3)), [0, 0]);
  assert.deepEqual(count(buildProposal("keep", [11], removals, 3)), [1, 1]);
});

test("減らす：外すだけで −3。足さない", () => {
  assert.deepEqual(buildProposal("decrease", additions, removals, 3), { additions: [], removals: [21, 22, 23] });
});

test("減らす：削除候補が3語より少なければ、あるだけ外す。なければ何もしない", () => {
  assert.deepEqual(count(buildProposal("decrease", additions, [21, 22], 3)), [0, 2]);
  assert.deepEqual(count(buildProposal("decrease", additions, [], 3)), [0, 0]);
});

test("幅 4：増やすは ＋4 か −4 ＋8、変えないは −4 ＋4、減らすは −4", () => {
  assert.deepEqual(count(buildProposal("increase", additions, [], 4)), [4, 0]);
  assert.deepEqual(count(buildProposal("increase", additions, removals, 4)), [8, 4]);
  assert.deepEqual(count(buildProposal("keep", additions, removals, 4)), [4, 4]);
  assert.deepEqual(count(buildProposal("decrease", additions, removals, 4)), [0, 4]);
});

test("幅 5：増やすは ＋5 か −5 ＋10、変えないは −5 ＋5、減らすは −5", () => {
  assert.deepEqual(count(buildProposal("increase", additions, [], 5)), [5, 0]);
  assert.deepEqual(count(buildProposal("increase", additions, removals, 5)), [10, 5]);
  assert.deepEqual(count(buildProposal("keep", additions, removals, 5)), [5, 5]);
  assert.deepEqual(count(buildProposal("decrease", additions, removals, 5)), [0, 5]);
});
