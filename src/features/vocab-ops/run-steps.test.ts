import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRunSteps, type StepEvent } from "./run-steps";
import type { VocabUpdate } from "./vocab-update-repository";

const baseUpdate: VocabUpdate = {
  id: 1,
  language: "en",
  status: "done",
  triggerGenerationSeq: 30,
  vocabSizeMode: "increase",
  versionBefore: 1,
  versionAfter: 2,
  validationPerformed: false,
  improvedCount: null,
  worsenedCount: null,
  sameCount: null,
  outcome: "applied",
  outcomeReason: "",
  costUsd: 0.001,
  error: null,
  createdAt: "2026-10-19T00:00:00Z",
  startedAt: "2026-10-19T00:00:00Z",
  finishedAt: "2026-10-19T00:00:10Z",
};

const event = (step: StepEvent["step"], second: number): StepEvent => ({
  step,
  message: step,
  createdAt: `2026-10-19T00:00:${String(second).padStart(2, "0")}Z`,
});

test("足すだけの語彙更新：検証は不要として飛ばし、ほかは済み。所要時間は前のステップからの秒数", () => {
  const steps = buildRunSteps(baseUpdate, [
    event("start", 0),
    event("additions", 1),
    event("ranking", 6),
    event("removals", 6),
    event("proposal", 7),
    event("result", 8),
  ]);
  assert.deepEqual(
    steps.map((step) => step.status),
    ["done", "done", "done", "done", "done", "skipped", "done"],
  );
  assert.equal(steps[2].durationSeconds, 5);
});

test("見送った語彙更新：最後のステップは「見送り」", () => {
  const steps = buildRunSteps({ ...baseUpdate, outcome: "skipped", versionAfter: null }, [event("start", 0), event("result", 3)]);
  assert.equal(steps.at(-1)?.status, "skipped");
  assert.equal(steps.at(-1)?.label, "見送り");
});

test("途中で失敗した語彙更新：記録が途切れたステップを失敗として示し、その先は未実行", () => {
  const steps = buildRunSteps({ ...baseUpdate, status: "failed", outcome: null }, [event("start", 0), event("additions", 1)]);
  assert.deepEqual(
    steps.map((step) => step.status),
    ["done", "done", "failed", "pending", "pending", "pending", "failed"],
  );
});

test("実行中の語彙更新：記録が途切れたステップを実行中として示す", () => {
  const steps = buildRunSteps({ ...baseUpdate, status: "running", outcome: null, finishedAt: null }, [event("start", 0)]);
  assert.deepEqual(
    steps.map((step) => step.status),
    ["done", "running", "pending", "pending", "pending", "pending", "pending"],
  );
});
