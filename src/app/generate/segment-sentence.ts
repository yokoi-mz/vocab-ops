import type { GeneratedToken } from "@/features/generation";

export type SentenceSegment = {
  text: string;
  token: GeneratedToken | null;
};

// 文を、単語の一覧の表層形で区切る。手札外語彙の語に色を付けるために使う。
// 文を先頭から順に探し、見つからない表層形（AI の書き出しが崩れたもの）は飛ばす。
export function segmentSentence(sentence: string, tokens: GeneratedToken[]): SentenceSegment[] {
  const segments: SentenceSegment[] = [];
  const lowerSentence = sentence.toLowerCase();
  let cursor = 0;
  for (const token of tokens) {
    if (token.surface === "") {
      continue;
    }
    const index = lowerSentence.indexOf(token.surface.toLowerCase(), cursor);
    if (index === -1) {
      continue;
    }
    if (index > cursor) {
      segments.push({ text: sentence.slice(cursor, index), token: null });
    }
    segments.push({ text: sentence.slice(index, index + token.surface.length), token });
    cursor = index + token.surface.length;
  }
  if (cursor < sentence.length) {
    segments.push({ text: sentence.slice(cursor), token: null });
  }
  return segments;
}
