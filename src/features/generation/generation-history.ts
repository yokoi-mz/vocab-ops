import { getDatabase } from "@/shared/db";
import {
  countDoneGenerationsAfter,
  findGeneration,
  listDoneGenerationRefs,
  listSentences,
  listWordOccurrences,
  type WordOccurrence,
} from "./generation-repository";
import type { GenerationDetail } from "./get-generations";

// 語彙更新が使う、文生成の履歴の読み出し。
// 回数は、残っている（削除されていない）完了した文生成の数で数える。

export function countDoneGenerationsSince(language: string, afterSeq: number): number {
  return countDoneGenerationsAfter(getDatabase(), language, afterSeq);
}

// 完了した文生成の通し番号（新しい順）。
export function listDoneSeqs(language: string): number[] {
  return listDoneGenerationRefs(getDatabase(), language).map((ref) => ref.seq);
}

// 完了した文生成の番号と通し番号（新しい順）。
export function listDoneGenerations(language: string): { id: number; seq: number }[] {
  return listDoneGenerationRefs(getDatabase(), language);
}

// 手札語彙の語が使われた文生成（手札語彙文・拡張語彙文のどちらか。文生成ごとに1回）。
export function listActiveWordUsages(language: string): WordOccurrence[] {
  return listWordOccurrences(getDatabase(), language, "active", null);
}

// 拡張語彙文に出てきた手札外語彙の語（文生成ごとに1回）。
export function listOutsideWordAppearances(language: string): WordOccurrence[] {
  return listWordOccurrences(getDatabase(), language, "outside", "expanded_set");
}

export function getDoneGenerationDetails(ids: number[]): GenerationDetail[] {
  const db = getDatabase();
  return ids.flatMap((id) => {
    const generation = findGeneration(db, id);
    return generation === undefined || generation.status !== "done" ? [] : [{ ...generation, sentences: listSentences(db, id) }];
  });
}
