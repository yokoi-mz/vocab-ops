import { getLanguageRules } from "./language-rules";
import { normalizeLemma } from "./normalize-lemma";

export type VocabEntry = {
  wordId: number;
  lemma: string;
  status: "active" | "uncounted";
};

export type TokenKind = "word" | "proper_noun" | "number";

export type TokenJudgement = "active" | "uncounted" | "outside" | "proper_or_number";

export type VocabLookup = {
  language: string;
  find(lemma: string): VocabEntry | undefined;
};

// 手札語彙とノーカン語彙から、辞書形で語を引ける表を作る。
// 複数語の見出し（avoir besoin de など）は、見出し全体に加えて、構成する各語でも引けるようにする。
export function createVocabLookup(language: string, entries: VocabEntry[]): VocabLookup {
  const entriesByKey = new Map<string, VocabEntry>();
  for (const entry of entries) {
    entriesByKey.set(normalizeLemma(entry.lemma), entry);
  }
  for (const entry of entries) {
    for (const part of normalizeLemma(entry.lemma).split(" ")) {
      if (!entriesByKey.has(part)) {
        entriesByKey.set(part, entry);
      }
    }
  }

  return {
    language,
    find(lemma) {
      for (const key of lemmaVariants(language, normalizeLemma(lemma))) {
        const entry = entriesByKey.get(key);
        if (entry !== undefined) {
          return entry;
        }
      }
      return undefined;
    },
  };
}

// 1つの辞書形から、表記ゆれを吸収した候補を作る。
// 例（イタリア語）：「preoccuparsi」→ ["preoccuparsi", "preoccupare"]
export function lemmaVariants(language: string, key: string): string[] {
  const rules = getLanguageRules(language);
  const variants = [key];
  for (const prefix of rules.removablePrefixes) {
    if (key.startsWith(prefix)) {
      variants.push(key.slice(prefix.length));
    }
  }
  for (const [from, to] of rules.suffixReplacements) {
    if (key.endsWith(from)) {
      variants.push(key.slice(0, -from.length) + to);
    }
  }
  return variants;
}

// 文の中の1語を、手札語彙・ノーカン語彙・手札外語彙・固有名詞と数字のどれかに判定する。
export function judgeToken(
  lookup: VocabLookup,
  token: { kind: TokenKind; surface: string; lemma: string },
): { judgement: TokenJudgement; wordId: number | null } {
  if (token.kind === "proper_noun") {
    return { judgement: "proper_or_number", wordId: null };
  }
  if (token.kind === "number" && /^[\p{N}\p{P}\s]+$/u.test(token.surface)) {
    return { judgement: "proper_or_number", wordId: null };
  }
  const entry = lookup.find(token.lemma);
  if (entry === undefined) {
    return { judgement: "outside", wordId: null };
  }
  return { judgement: entry.status, wordId: entry.wordId };
}
