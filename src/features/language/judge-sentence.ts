import { getLanguageRules } from "./language-rules";
import { normalizeLemma } from "./normalize-lemma";
import { splitWords } from "./split-words";
import { judgeToken, type TokenJudgement, type TokenKind, type VocabLookup } from "./vocab-lookup";

export type AnswerToken = {
  surface: string;
  lemma: string;
  kind: TokenKind;
};

export type JudgedToken<T extends AnswerToken> = T & {
  judgement: TokenJudgement;
  wordId: number | null;
};

export type SentenceProblem =
  | { type: "too_many_outside_words"; outsideLemmas: string[]; limit: number }
  | { type: "missing_tokens"; words: string[] }
  | { type: "suspicious_lemmas"; tokens: { surface: string; lemma: string }[] };

export type SentenceJudgement<T extends AnswerToken> = {
  tokens: JudgedToken<T>[];
  outsideLemmas: string[];
  problems: SentenceProblem[];
};

// AI が作った1つの文を採点する。problems が空なら合格。
//   チェック A：手札外語彙の語（辞書形の種類数）が上限以下か
//   チェック B：文の単語が、すべて単語の一覧（tokens）に載っているか
//   チェック C：手札語彙・ノーカン語彙と判定した語に、辞書形の取り違えが疑われるものがないか
export function judgeSentence<T extends AnswerToken>(
  lookup: VocabLookup,
  sentence: string,
  tokens: T[],
  outsideWordLimit: number,
): SentenceJudgement<T> {
  // 句読点だけの単語（AI が「?」などを1語として書き出したもの）は、語として扱わない
  const judgedTokens = tokens
    .filter((token) => /[\p{L}\p{N}]/u.test(token.surface))
    .map((token) => ({ ...token, ...judgeToken(lookup, token) }));
  const outsideLemmas = [
    ...new Set(judgedTokens.filter((token) => token.judgement === "outside").map((token) => normalizeLemma(token.lemma))),
  ];

  const problems: SentenceProblem[] = [];
  if (outsideLemmas.length > outsideWordLimit) {
    problems.push({ type: "too_many_outside_words", outsideLemmas, limit: outsideWordLimit });
  }
  const missingWords = findMissingWords(lookup.language, sentence, tokens);
  if (missingWords.length > 0) {
    problems.push({ type: "missing_tokens", words: missingWords });
  }
  const suspiciousTokens = judgedTokens.filter(
    (token) => (token.judgement === "active" || token.judgement === "uncounted") && isSuspiciousLemma(lookup.language, token),
  );
  if (suspiciousTokens.length > 0) {
    problems.push({
      type: "suspicious_lemmas",
      tokens: suspiciousTokens.map((token) => ({ surface: token.surface, lemma: token.lemma })),
    });
  }

  return { tokens: judgedTokens, outsideLemmas, problems };
}

// チェック B：文に出てくるのに、単語の一覧に載っていない単語を返す。
function findMissingWords(language: string, sentence: string, tokens: AnswerToken[]): string[] {
  const listedWords = new Set(tokens.flatMap((token) => splitWords(language, token.surface)));
  // 英語の短縮形を do + n't のように2つに分けて書き出した場合も、つなげた形（don't）で一致とみなす
  for (let i = 0; i + 1 < tokens.length; i++) {
    listedWords.add(normalizeLemma(tokens[i].surface + tokens[i + 1].surface));
  }
  const listedWordsWithoutLastVowel = new Set(
    [...listedWords].filter((word) => /[aeiouàâäéèêëìíîïòóôöùúûü]$/.test(word)).map((word) => word.slice(0, -1)),
  );

  const missing = splitWords(language, sentence).filter(
    // j' を AI が je と書くことがあるので、母音で終わる語は末尾の母音を落とした形でも一致とみなす
    (word) => !listedWords.has(word) && !listedWordsWithoutLastVowel.has(word),
  );
  return [...new Set(missing)];
}

// チェック C：表層形が4文字以上、辞書形が4文字以下、頭文字が違い、表層形が辞書形を含まないものを疑う。
// 例：Ding → kein は疑う。言語ごとの例外（suis → être、went → go など）は疑わない。
function isSuspiciousLemma(language: string, token: AnswerToken): boolean {
  const surface = normalizeLemma(token.surface);
  const lemma = normalizeLemma(token.lemma);
  const rules = getLanguageRules(language);
  if (lemma.includes(" ") || rules.irregularLemmas.includes(lemma)) {
    return false;
  }
  if (rules.irregularForms.some(([form, formLemma]) => form === surface && formLemma === lemma)) {
    return false;
  }
  return surface.length >= 4 && lemma.length <= 4 && surface[0] !== lemma[0] && !surface.includes(lemma);
}
