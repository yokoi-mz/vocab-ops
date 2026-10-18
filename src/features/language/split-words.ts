import { getLanguageRules } from "./language-rules";
import { normalizeLemma } from "./normalize-lemma";

const wordPattern = /[\p{L}\p{M}\p{N}]+/gu;
const wordWithApostrophePattern = /[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu;

// 文を、比べるための形（normalizeLemma でそろえた形）の単語に分ける。
// 例：「J'ai vécu six mois en Italie.」→ ["j", "ai", "vécu", "six", "mois", "en", "italie"]
export function splitWords(language: string, text: string): string[] {
  const pattern = getLanguageRules(language).keepsApostropheInsideWords ? wordWithApostrophePattern : wordPattern;
  return (text.match(pattern) ?? []).map((word) => normalizeLemma(word));
}
