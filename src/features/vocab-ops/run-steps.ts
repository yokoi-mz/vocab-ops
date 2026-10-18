import type { VocabUpdate } from "./vocab-update-repository";

// 語彙更新1回を、ステップの並びとして見せるための組み立て（Ops の画面の「語彙更新の詳細」）。
// DB も AI も使わない関数なので、語彙更新の記録と、その語彙更新の動きの記録（古い順）を引数で受け取る。

// 語彙更新のステップ。動きの記録に、どのステップの記録かとして残す
export type VocabUpdateStep = "queued" | "start" | "additions" | "ranking" | "removals" | "proposal" | "validation" | "result";

export type RunStepStatus = "done" | "skipped" | "failed" | "running" | "pending";

export type RunStep = {
  key: Exclude<VocabUpdateStep, "queued">;
  label: string;
  status: RunStepStatus;
  // そのステップが終わった時刻と、前のステップが終わってからの秒数（記録がなければ null）
  finishedAt: string | null;
  durationSeconds: number | null;
  messages: string[];
};

export type StepEvent = {
  step: VocabUpdateStep;
  message: string;
  createdAt: string;
};

const steps: { key: RunStep["key"]; label: string }[] = [
  { key: "start", label: "開始" },
  { key: "additions", label: "追加候補の集計" },
  { key: "ranking", label: "LLM の順位付け" },
  { key: "removals", label: "削除候補の判定" },
  { key: "proposal", label: "更新案" },
  { key: "validation", label: "語彙更新検証" },
  { key: "result", label: "反映" },
];

export function buildRunSteps(update: VocabUpdate, events: StepEvent[]): RunStep[] {
  const result: RunStep[] = [];
  let previousTime = update.startedAt;
  let failedOrRunningPlaced = false;

  for (const { key, label } of steps) {
    const own = events.filter((event) => event.step === key);
    const finishedAt = own.at(-1)?.createdAt ?? null;
    const durationSeconds =
      finishedAt !== null && previousTime !== null ? Math.max(0, (Date.parse(finishedAt) - Date.parse(previousTime)) / 1000) : null;
    const step: RunStep = {
      key,
      label: key === "result" ? resultLabel(update) : label,
      status: "pending",
      finishedAt,
      durationSeconds,
      messages: own.map((event) => event.message),
    };

    if (key === "result") {
      step.status = update.status === "failed" ? "failed" : update.status !== "done" ? "pending" : update.outcome === "applied" ? "done" : "skipped";
    } else if (own.length > 0 || (update.status === "done" && events.length === 0 && key !== "validation")) {
      // 記録があるステップは済み。記録を残す前の古い語彙更新は、完了していれば済みとみなす
      step.status = "done";
    } else if (key === "validation" && update.status === "done" && !update.validationPerformed) {
      step.status = "skipped";
      step.messages = ["足す語と外す語の両方を含む更新案ではないので、検証は不要"];
    } else if (key === "validation" && update.validationPerformed) {
      step.status = "done";
    } else if (!failedOrRunningPlaced && (update.status === "failed" || update.status === "running")) {
      // 記録が途切れたところのステップを、失敗（または実行中）として示す
      step.status = update.status === "failed" ? "failed" : "running";
      failedOrRunningPlaced = true;
    } else if (update.status === "done") {
      step.status = "skipped";
    }

    if (finishedAt !== null) {
      previousTime = finishedAt;
    }
    result.push(step);
  }
  return result;
}

function resultLabel(update: VocabUpdate): string {
  if (update.status === "failed") return "失敗";
  if (update.status !== "done") return "反映";
  return update.outcome === "applied" ? "反映" : "見送り";
}
