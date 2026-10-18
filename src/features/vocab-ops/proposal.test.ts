import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProposal } from "./proposal";

const additions = [11, 12, 13, 14, 15, 16, 17];
const removals = [21, 22, 23];

test("増やす：足すのは上限まで、外すのは足す数を超えない", () => {
  assert.deepEqual(buildProposal("increase", additions, removals, 5, 5), { additions: [11, 12, 13, 14, 15], removals: [21, 22, 23] });
  assert.deepEqual(buildProposal("increase", [11, 12], removals, 5, 5), { additions: [11, 12], removals: [21, 22] });
});

test("増やす：追加候補がなければ、何も外さない", () => {
  assert.deepEqual(buildProposal("increase", [], removals, 5, 5), { additions: [], removals: [] });
});

test("変えない：足す数と外す数を同じにする", () => {
  assert.deepEqual(buildProposal("keep", additions, removals, 5, 5), { additions: [11, 12, 13], removals: [21, 22, 23] });
  assert.deepEqual(buildProposal("keep", additions, [], 5, 5), { additions: [], removals: [] });
});

test("減らす：外す数より少なく足し、必ず純減にする", () => {
  assert.deepEqual(buildProposal("decrease", additions, removals, 5, 5), { additions: [11, 12], removals: [21, 22, 23] });
  assert.deepEqual(buildProposal("decrease", additions, [21], 5, 5), { additions: [], removals: [21] });
});

test("減らす：削除候補がなければ、何もしない", () => {
  assert.deepEqual(buildProposal("decrease", additions, [], 5, 5), { additions: [], removals: [] });
});
