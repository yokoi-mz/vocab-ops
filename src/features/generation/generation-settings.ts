import type { ProviderRouting } from "@/shared/openrouter";

// 文生成に使う AI のモデル（OpenRouter のモデルの ID）
export const generationModel = "deepseek/deepseek-v4.1-flash";

// モデルを動かす会社。旧版と同じ DeepInfra（fp8）に固定する。
// 指定しないと、OpenRouter が呼ぶたびに会社を選び、会社によって料金が大きく違う（出力で最大 15 倍ほど）ため
export const generationProvider: ProviderRouting = { only: ["deepinfra"], quantizations: ["fp8"], allowFallbacks: false };

// 採点に通らなかったときに、AI に作らせる回数の上限（最初の1回を含む）。
// 2026-10-18 の実験（docs/vocab-ops/experiments/2026-10-18-prompt-tuning.md）では、手札語彙文の 40 回中、
// 3回目までに通らなかったのが 2 回、4回目までに全部通った。余裕を見て 5 回にする。
export const maxAttempts = 5;
