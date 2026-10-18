import { getVocabSnapshot, registerOutsideWord, takeNextGenerationSeq } from "@/features/vocabulary";
import { getDatabase } from "@/shared/db";
import { generateSentence, SentenceGenerationError, type SentenceResult } from "./generate-sentence";
import {
  claimNextPendingGeneration,
  failGeneration,
  finishGeneration,
  insertGeneration,
  insertSentence,
  insertToken,
  resetRunningGenerations,
  setGenerationContext,
  type ClaimedGeneration,
  type SentenceType,
  type Speaker,
} from "./generation-repository";
import { generationModel } from "./generation-settings";
import { promptVersion } from "./prompt";

export type GenerationInput = {
  language: string;
  message: string;
  situation: string | null;
  speaker: Speaker;
};

// 文生成の依頼を受け付ける。DB に「待ち」として書くだけで、すぐに番号を返す。実際の処理はワーカーが行う。
export function requestGeneration(input: GenerationInput): number {
  const db = getDatabase();
  db.exec("BEGIN");
  try {
    const seq = takeNextGenerationSeq(input.language);
    const id = insertGeneration(db, { ...input, seq });
    db.exec("COMMIT");
    return id;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// ワーカーが途中で止まったときに「実行中」のまま残った文生成を、待ちに戻す。ワーカーの起動時に呼ぶ。
export function recoverInterruptedGenerations(): void {
  resetRunningGenerations(getDatabase());
}

// 待ちの文生成を1件取り出して処理する。処理するものがなければ undefined を返す。
export async function runNextGeneration(): Promise<ClaimedGeneration | undefined> {
  const generation = claimNextPendingGeneration(getDatabase());
  if (generation === undefined) {
    return undefined;
  }
  await generateWithVocab(generation);
  return generation;
}

// 手札語彙での文生成。手札語彙文と拡張語彙文を同時に作り、結果を保存する。
async function generateWithVocab(generation: ClaimedGeneration): Promise<void> {
  const db = getDatabase();
  try {
    // 使う手札語彙を、ここで確定する。この文生成では、最後までこの手札語彙を使う
    const snapshot = getVocabSnapshot(generation.language);
    setGenerationContext(db, generation.id, {
      activeVocabVersion: snapshot.version,
      model: generationModel,
      promptVersion,
      expandedOutsideWordLimit: snapshot.expandedOutsideWordLimit,
    });

    const input = {
      language: generation.language,
      outsideWordLimit: snapshot.expandedOutsideWordLimit,
      uncountedLemmas: snapshot.uncountedWords.map((word) => word.lemma),
      activeWords: snapshot.activeWords,
      message: generation.message,
      situation: generation.situation,
      speaker: generation.speaker,
    };
    const sentenceTypes: SentenceType[] = ["current_set", "expanded_set"];
    const results = await Promise.allSettled(
      sentenceTypes.map((sentenceType) => generateSentence({ ...input, sentenceType }, snapshot.lookup)),
    );

    const costUsd = results.reduce(
      (sum, result) =>
        sum +
        (result.status === "fulfilled"
          ? result.value.costUsd
          : result.reason instanceof SentenceGenerationError
            ? result.reason.costUsd
            : 0),
      0,
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure !== undefined) {
      const reason = failure.reason instanceof Error ? failure.reason.message : String(failure.reason);
      failGeneration(db, generation.id, reason, costUsd);
      return;
    }

    db.exec("BEGIN");
    try {
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          saveSentence(generation, sentenceTypes[index], result.value);
        }
      });
      finishGeneration(db, generation.id, costUsd);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } catch (error) {
    failGeneration(db, generation.id, error instanceof Error ? error.message : String(error), 0);
  }
}

function saveSentence(generation: ClaimedGeneration, sentenceType: SentenceType, result: SentenceResult): void {
  const db = getDatabase();
  const sentenceId = insertSentence(db, {
    generationId: generation.id,
    sentenceType,
    sentence: result.answer.expression,
    translation: result.answer.full_translation,
    comment: result.answer.comment,
    attempts: result.attempts,
    unresolvedProblemsJson: result.unresolvedProblems === null ? null : JSON.stringify(result.unresolvedProblems),
  });
  result.judgement.tokens.forEach((token, position) => {
    const wordId =
      token.judgement === "outside"
        ? registerOutsideWord(generation.language, { lemma: token.lemma, meaning: token.meaning, partOfSpeech: token.pos })
        : token.wordId;
    insertToken(db, {
      sentenceId,
      position,
      surface: token.surface,
      wordId,
      lemma: token.lemma,
      meaning: token.meaning,
      partOfSpeech: token.pos,
      judgement: token.judgement,
    });
  });
}
