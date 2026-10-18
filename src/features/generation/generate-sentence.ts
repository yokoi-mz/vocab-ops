import { judgeSentence, type SentenceJudgement, type SentenceProblem, type VocabLookup } from "@/features/language";
import { callOpenRouter } from "@/shared/openrouter";
import { parseAnswer, type Answer, type AnswerTokenWithMeaning } from "./answer";
import { generationModel, generationProvider, maxAttempts } from "./generation-settings";
import { buildFeedback, buildPrompt, systemPrompt, type PromptInput } from "./prompt";

export type SentenceResult = {
  answer: Answer;
  judgement: SentenceJudgement<AnswerTokenWithMeaning>;
  attempts: number;
  // 上限まで作らせても採点に通らなかったときの、残った問題。通ったときは null
  unresolvedProblems: SentenceProblem[] | null;
  costUsd: number;
};

// 文を作れなかったとき（AI を呼べなかった、返事を一度も読めなかった）のエラー。それまでの費用を持つ。
export class SentenceGenerationError extends Error {
  constructor(
    message: string,
    readonly costUsd: number,
  ) {
    super(message);
  }
}

// 1つの文を作る。採点に通らなければ、だめだった理由を付けて作り直させる（最大 maxAttempts 回）。
export async function generateSentence(input: Omit<PromptInput, "feedback">, lookup: VocabLookup): Promise<SentenceResult> {
  const outsideWordLimit = input.sentenceType === "current_set" ? 0 : input.outsideWordLimit;
  let feedback: string | null = null;
  let costUsd = 0;
  let lastResult: Omit<SentenceResult, "unresolvedProblems" | "costUsd"> | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let text: string;
    try {
      const result = await callOpenRouter(
        generationModel,
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildPrompt({ ...input, feedback }) },
        ],
        generationProvider,
      );
      costUsd += result.costUsd;
      text = result.text;
    } catch (error) {
      // AI 側の失敗（時間切れ、エラーの返事）は作り直さない
      throw new SentenceGenerationError(error instanceof Error ? error.message : String(error), costUsd);
    }

    const answer = parseAnswer(text);
    if (answer === undefined) {
      feedback = buildFeedback(null, "unparsable");
      continue;
    }
    const judgement = judgeSentence(lookup, answer.expression, answer.tokens, outsideWordLimit);
    lastResult = { answer, judgement, attempts: attempt };
    if (judgement.problems.length === 0) {
      return { ...lastResult, unresolvedProblems: null, costUsd };
    }
    feedback = buildFeedback(answer.expression, judgement.problems);
  }

  if (lastResult === undefined) {
    throw new SentenceGenerationError("AI の返事を JSON として読めませんでした。", costUsd);
  }
  return { ...lastResult, unresolvedProblems: lastResult.judgement.problems, costUsd };
}
