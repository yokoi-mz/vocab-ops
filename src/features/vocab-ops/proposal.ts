import type { VocabSizeMode } from "@/features/vocabulary";

export type Proposal = {
  additions: number[];
  removals: number[];
};

// 増減モードに合わせて、追加候補と削除候補（どちらも順位の高い順の語の番号）から、更新案を作る（04-vocab-size-mode.md）。
//   size：語彙更新の幅。1回の語彙更新で増やす・減らす語数で、入れ替える語数の上限も同じ数（言語ごとに 3・4・5 から選ぶ）
//
//   増やす：削除候補がなければ ＋size。あれば −size ＋(size×2) まで。差し引きは必ずプラス
//   変えない：−size ＋size まで。差し引きは 0
//   減らす：−size まで。外すだけで、足さない（入れ替えはしないので、語彙更新検証も動かない）
export function buildProposal(mode: VocabSizeMode, additionCandidates: number[], removalCandidates: number[], size: number): Proposal {
  if (mode === "increase") {
    const additionCount = Math.min(additionCandidates.length, size + Math.min(size, removalCandidates.length));
    // 追加候補が足りないときも、差し引きがプラスのままになるように、外す数を減らす
    const removalCount = Math.min(size, removalCandidates.length, Math.max(0, additionCount - size));
    return { additions: additionCandidates.slice(0, additionCount), removals: removalCandidates.slice(0, removalCount) };
  }
  if (mode === "keep") {
    const count = Math.min(size, additionCandidates.length, removalCandidates.length);
    return { additions: additionCandidates.slice(0, count), removals: removalCandidates.slice(0, count) };
  }
  return { additions: [], removals: removalCandidates.slice(0, size) };
}
