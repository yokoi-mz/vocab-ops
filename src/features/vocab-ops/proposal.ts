import type { VocabSizeMode } from "@/features/vocabulary";

export type Proposal = {
  additions: number[];
  removals: number[];
};

// 増減モードに合わせて、追加候補と削除候補（どちらも順位の高い順の語の番号）から、更新案を作る（04-vocab-size-mode.md）。
//   sizeStep：1回の語彙更新で増やす・減らす語数（例：3）
//   swapLimit：1回の語彙更新で入れ替える語数の上限（例：3）
//
//   増やす：削除候補がなければ ＋sizeStep。あれば −swapLimit ＋(sizeStep＋swapLimit) まで。差し引きは必ずプラス
//   変えない：−swapLimit ＋swapLimit まで。差し引きは 0
//   減らす：−sizeStep まで。外すだけで、足さない（入れ替えはしないので、語彙更新検証も動かない）
export function buildProposal(
  mode: VocabSizeMode,
  additionCandidates: number[],
  removalCandidates: number[],
  sizeStep: number,
  swapLimit: number,
): Proposal {
  if (mode === "increase") {
    const additionCount = Math.min(additionCandidates.length, sizeStep + Math.min(swapLimit, removalCandidates.length));
    // 追加候補が足りないときも、差し引きがプラスのままになるように、外す数を減らす
    const removalCount = Math.min(swapLimit, removalCandidates.length, Math.max(0, additionCount - sizeStep));
    return { additions: additionCandidates.slice(0, additionCount), removals: removalCandidates.slice(0, removalCount) };
  }
  if (mode === "keep") {
    const count = Math.min(swapLimit, additionCandidates.length, removalCandidates.length);
    return { additions: additionCandidates.slice(0, count), removals: removalCandidates.slice(0, count) };
  }
  return { additions: [], removals: removalCandidates.slice(0, sizeStep) };
}
