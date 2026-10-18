// 削除候補（03-removal-candidates.md）。LLM を使わず、使用履歴から機械的に判定する。
// DB も AI も使わない関数なので、入力はすべて引数で受け取る。

export type RemovalEvidence = {
  // 手札語彙に入ってからの文生成回数
  generationsSinceAdded: number;
  // 手札語彙に入ってから使われた文生成の数
  totalUses: number;
  // 直近の集計期間で使われた文生成の数
  recentUses: number;
  // 最後に使われてから（一度も使われていなければ、手札語彙に入ってから）の文生成の数
  generationsSinceLastUse: number;
};

export type RemovalCandidate = {
  wordId: number;
  lemma: string;
  evidence: RemovalEvidence;
  reason: string;
};

export type RemovalInput = {
  activeWords: { id: number; lemma: string; addedGenerationSeq: number | null }[];
  // 残っている、完了した文生成の通し番号（順番は問わない）
  doneSeqs: number[];
  // 手札語彙の語が使われた文生成（文生成ごとに1回）
  usages: { wordId: number; seq: number }[];
  minGenerationsSinceAdded: number;
  recentWindow: number;
  maxRecentUses: number;
};

// 削除候補を、最後に使われてからの文生成の数が多い順に返す。
export function findRemovalCandidates(input: RemovalInput): RemovalCandidate[] {
  const doneSeqs = [...input.doneSeqs].sort((a, b) => b - a);
  const recentSeqs = new Set(doneSeqs.slice(0, input.recentWindow));
  const countDoneAfter = (seq: number) => doneSeqs.filter((doneSeq) => doneSeq > seq).length;

  const candidates: RemovalCandidate[] = [];
  for (const word of input.activeWords) {
    const addedSeq = word.addedGenerationSeq ?? 0;
    // 手札語彙に入っている期間（今回入ってから）の使用だけを数える
    const useSeqs = input.usages.filter((usage) => usage.wordId === word.id && usage.seq > addedSeq).map((usage) => usage.seq);
    const evidence: RemovalEvidence = {
      generationsSinceAdded: countDoneAfter(addedSeq),
      totalUses: useSeqs.length,
      recentUses: useSeqs.filter((seq) => recentSeqs.has(seq)).length,
      generationsSinceLastUse: countDoneAfter(useSeqs.length === 0 ? addedSeq : Math.max(...useSeqs)),
    };
    if (evidence.generationsSinceAdded >= input.minGenerationsSinceAdded && evidence.recentUses <= input.maxRecentUses) {
      candidates.push({
        wordId: word.id,
        lemma: word.lemma,
        evidence,
        reason: `手札語彙に入ってから ${evidence.generationsSinceAdded} 回の文生成があり、直近 ${input.recentWindow} 回で使われたのは ${evidence.recentUses} 回（最後に使われてから ${evidence.generationsSinceLastUse} 回）`,
      });
    }
  }
  return candidates.sort((a, b) => b.evidence.generationsSinceLastUse - a.evidence.generationsSinceLastUse);
}
