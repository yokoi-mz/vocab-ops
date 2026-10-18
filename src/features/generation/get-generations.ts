import { getDatabase } from "@/shared/db";
import {
  findGeneration,
  listGenerations,
  listSentences,
  type GeneratedSentence,
  type Generation,
} from "./generation-repository";

export type GenerationDetail = Generation & {
  sentences: GeneratedSentence[];
};

export function getGenerationDetail(id: number): GenerationDetail | undefined {
  const db = getDatabase();
  const generation = findGeneration(db, id);
  if (generation === undefined) {
    return undefined;
  }
  return { ...generation, sentences: listSentences(db, id) };
}

export function listRecentGenerations(language: string, limit: number, beforeSeq: number | null): GenerationDetail[] {
  const db = getDatabase();
  return listGenerations(db, language, limit, beforeSeq).map((generation) => ({
    ...generation,
    sentences: listSentences(db, generation.id),
  }));
}
