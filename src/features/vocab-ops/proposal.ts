import type { VocabSizeMode } from "@/features/vocabulary";

export type Proposal = {
  additions: number[];
  removals: number[];
};

// 増減モードに合わせて、追加候補と削除候補（どちらも順位の高い順の語の番号）から、更新案を作る（04-vocab-size-mode.md）。
//   増やす：足すのは上限まで。外すのは、足す数を超えない範囲（数を減らさない）
//   変えない：足す数と外す数を同じにする
//   減らす：外すのは上限まで。足すのは、外す数より少ない範囲（必ず純減にする）
export function buildProposal(
  mode: VocabSizeMode,
  additionCandidates: number[],
  removalCandidates: number[],
  maxAdditions: number,
  maxRemovals: number,
): Proposal {
  if (mode === "increase") {
    const additions = additionCandidates.slice(0, maxAdditions);
    return { additions, removals: removalCandidates.slice(0, Math.min(maxRemovals, additions.length)) };
  }
  if (mode === "keep") {
    const count = Math.min(additionCandidates.length, removalCandidates.length, maxAdditions, maxRemovals);
    return { additions: additionCandidates.slice(0, count), removals: removalCandidates.slice(0, count) };
  }
  const removals = removalCandidates.slice(0, maxRemovals);
  return { additions: additionCandidates.slice(0, Math.min(maxAdditions, Math.max(removals.length - 1, 0))), removals };
}
