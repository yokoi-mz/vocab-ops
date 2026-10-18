export type LanguageRules = {
  // プロンプトに書く、英語での言語名
  englishName: string;
  // 読み上げに使う言語と地域（ブラウザの音声合成に渡す）
  speechLang: string;
  // 話し手の性別で、自分について言うときの語形が変わる言語か（je suis fatiguée など）。
  // 変わらない言語では、画面で女性形・男性形を選ばせず、プロンプトにも書かない
  hasSpeakerGender: boolean;
  // プロンプトに差し込む、文法で特に確かめてほしいこと
  grammarChecks: string;
  // プロンプトに差し込む、単語の書き出しの特別ルール
  tokenRules: string[];
  // 英語の don't や we're のように、単語の中のアポストロフィで単語を切らない言語
  keepsApostropheInsideWords: boolean;
  // 辞書形の表記ゆれの吸収：先頭から外してよい語（再帰代名詞など）
  removablePrefixes: string[];
  // 辞書形の表記ゆれの吸収：語尾の置き換え（再帰動詞の -arse → -ar など）
  suffixReplacements: [string, string][];
  // チェック C で疑わない辞書形（形がまったく変わる動詞など）
  irregularLemmas: string[];
  // チェック C で疑わない「表層形 → 辞書形」の組（比較級、代名詞の格変化、不規則動詞など）
  irregularForms: [string, string][];
  // 語形変化で辞書形の後ろに付く語尾（英語の -s、-ed、-ing など）。
  // 表層形が「辞書形＋これ以外の文字」なら、別の語（weekend を week と書き出したなど）として疑う。
  // null の言語では、この確認をしない（語形変化で語幹が変わる言語が多く、語尾だけで判断できないため）
  inflectionSuffixes: string[] | null;
};

const defaultRules: LanguageRules = {
  englishName: "",
  speechLang: "",
  hasSpeakerGender: true,
  grammarChecks: "auxiliaries, agreement, prepositions, word order.",
  tokenRules: [],
  keepsApostropheInsideWords: false,
  removablePrefixes: [],
  suffixReplacements: [],
  irregularLemmas: [],
  irregularForms: [],
  inflectionSuffixes: null,
};

const rulesByLanguage: Record<string, Partial<LanguageRules>> = {
  en: {
    englishName: "English",
    speechLang: "en-GB",
    hasSpeakerGender: false,
    grammarChecks:
      "Tense consistency (past simple vs present perfect). Third person -s. Articles (a / an / the). Prepositions of time and place (in / on / at). Question word order with do / does / did.",
    tokenRules: [
      'English contractions: split into two tokens. "don\'t" → "do" (lemma "do") + "n\'t" (lemma "not"); "it\'s" → "it" + "\'s" (lemma "be" or "have"); "we\'re" → "we" + "\'re" (lemma "be"); "I\'m" → "I" + "\'m" (lemma "be"); "I\'ll" → "I" + "\'ll" (lemma "will"); "I\'ve" → "I" + "\'ve" (lemma "have"); "can\'t" → "ca" (lemma "can") + "n\'t" (lemma "not").',
    ],
    keepsApostropheInsideWords: true,
    irregularForms: [
      ["went", "go"],
      ["were", "be"],
      ["better", "good"],
      ["best", "good"],
      ["better", "well"],
      ["best", "well"],
      ["worse", "bad"],
      ["worst", "bad"],
      ["elder", "old"],
      ["myself", "i"],
      ["hers", "she"],
      ["herself", "she"],
      ["ours", "we"],
      ["ourselves", "we"],
      ["cannot", "can"],
      ["done", "do"],
      ["gone", "go"],
      ["children", "child"],
    ],
    inflectionSuffixes: ["s", "es", "d", "ed", "t", "ing", "er", "est", "ly", "n", "en", "n't", "'s", "'re", "'ll", "'ve", "'m", "'d"],
  },
  fr: {
    englishName: "French",
    speechLang: "fr-FR",
    grammarChecks:
      "passé composé auxiliary: être for movement/state verbs (aller, venir, rester, partir, arriver, sortir, entrer, naître, mourir, tomber, retourner) and all pronominal verbs → je suis resté, je suis allé, je me suis souvenu; avoir otherwise. Past participle agreement with être. Country prepositions: en Italie / au Japon / aux États-Unis. Negation ne ... pas. Elision (j', l', qu').",
    tokenRules: ['Elided forms: "J\'" → lemma "je", "l\'" → "le", "d\'" → "de", "qu\'" → "que".'],
    removablePrefixes: ["se ", "s'"],
    irregularLemmas: ["être"],
    irregularForms: [["mieux", "bien"]],
  },
  it: {
    englishName: "Italian",
    speechLang: "it-IT",
    grammarChecks:
      "passato prossimo auxiliary: essere for movement/state verbs (andare, venire, stare, essere, restare, tornare, partire, uscire) and reflexive verbs, with participle agreement → sono andato/a; avere otherwise. Article + possessive (il mio amico). Articulated prepositions (nel, alla, dal). piacere construction (mi piace).",
    tokenRules: ['Elided forms: "l\'" → lemma "il" or "lo", "un\'" → "uno", "c\'" → "ci".'],
    suffixReplacements: [
      ["arsi", "are"],
      ["ersi", "ere"],
      ["irsi", "ire"],
    ],
    irregularForms: [
      ["meglio", "bene"],
      ["nella", "in"],
      ["nello", "in"],
      ["negli", "in"],
      ["nelle", "in"],
    ],
  },
  es: {
    englishName: "Spanish",
    speechLang: "es-ES",
    grammarChecks:
      "ser vs estar. gustar / encantar construction (me gusta). Preterite vs imperfect used appropriately. Personal a before people. Adjective agreement.",
    removablePrefixes: ["se "],
    suffixReplacements: [
      ["arse", "ar"],
      ["erse", "er"],
      ["irse", "ir"],
    ],
    irregularLemmas: ["ser", "ir"],
  },
  de: {
    englishName: "German",
    speechLang: "de-DE",
    grammarChecks:
      "Verb-second word order in main clauses, verb-final in subordinate clauses (weil, dass, wenn). Perfekt auxiliary: sein for movement/state change (gehen, fahren, kommen, bleiben), haben otherwise. Separable verbs. Cases after prepositions and articles. Noun capitalization.",
    tokenRules: ["German separable verbs: give the separated particle token the same lemma as the verb."],
    removablePrefixes: ["sich "],
    irregularLemmas: ["sein"],
    irregularForms: [
      ["besser", "gut"],
      ["ihnen", "sie"],
      ["euch", "ihr"],
    ],
  },
  sv: {
    englishName: "Swedish",
    speechLang: "sv-SE",
    hasSpeakerGender: false,
    grammarChecks:
      "Verb-second word order in main clauses. Definite forms (suffixed articles: huset, bilen). en/ett gender agreement. Adjective agreement (stor / stort / stora).",
  },
};

export function getLanguageRules(language: string): LanguageRules {
  return { ...defaultRules, ...rulesByLanguage[language] };
}
