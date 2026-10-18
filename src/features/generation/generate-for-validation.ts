import type { VocabSnapshot } from "@/features/vocabulary";
import { generateSentence } from "./generate-sentence";
import { generationModel } from "./generation-settings";
import type { GenerationDetail } from "./get-generations";
import { promptVersion } from "./prompt";

// 語彙更新検証のための文生成。決めた手札語彙（今の手札語彙、または更新案を反映した手札語彙）で、
// 手札語彙文を1つだけ作る。結果は文生成の履歴には保存しない。
export async function generateCurrentSetSentence(
  snapshot: VocabSnapshot,
  source: Pick<GenerationDetail, "message" | "situation" | "speaker">,
): Promise<{ sentence: string; costUsd: number }> {
  const result = await generateSentence(
    {
      language: snapshot.language,
      sentenceType: "current_set",
      outsideWordLimit: 0,
      uncountedLemmas: snapshot.uncountedWords.map((word) => word.lemma),
      activeWords: snapshot.activeWords,
      message: source.message,
      situation: source.situation,
      speaker: source.speaker,
    },
    snapshot.lookup,
  );
  return { sentence: result.answer.expression, costUsd: result.costUsd };
}

// 保存済みの手札語彙文を、語彙更新検証でそのまま使えるか。
// そのときの手札語彙の版・モデル・プロンプトの版が、今と同じなら使える（05-validation.md）。
export function canReuseCurrentSetSentence(generation: GenerationDetail, activeVocabVersion: number): boolean {
  return (
    generation.activeVocabVersion === activeVocabVersion &&
    generation.model === generationModel &&
    generation.promptVersion === promptVersion &&
    generation.sentences.some((sentence) => sentence.sentenceType === "current_set" && sentence.unresolvedProblemsJson === null)
  );
}
