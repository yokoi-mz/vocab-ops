import { z } from "zod";

const answerSchema = z.object({
  expression: z.string().min(1),
  tokens: z.array(
    z.object({
      surface: z.string(),
      lemma: z.string(),
      meaning: z.string().nullable().catch(null),
      kind: z.enum(["word", "proper_noun", "number"]).catch("word"),
      pos: z.string().nullable().catch(null),
    }),
  ),
  full_translation: z.string(),
  comment: z.string(),
});

export type Answer = z.infer<typeof answerSchema>;
export type AnswerTokenWithMeaning = Answer["tokens"][number];

// AI の返事から JSON を取り出し、形を確かめる。読めなければ undefined。
// コードの囲みや前置きが付いていても読めるように、最初の { から最後の } までを読む。
export function parseAnswer(text: string): Answer | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return undefined;
  }
  try {
    const parsed = answerSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
