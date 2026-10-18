import { getLanguageRules, type SentenceProblem } from "@/features/language";
import type { SentenceType, Speaker } from "./generation-repository";

// プロンプトを変えたら、この版を進める。文生成の記録に残し、語彙更新検証で保存済みの文を使い回せるかの判断に使う。
export const promptVersion = "2026-10-19.1";

export const systemPrompt = `You are a speaking-simulation engine for a language learner.
The learner may only use a limited set of words. Your job is to express what they want to say
in the target language while respecting a strict budget of NEW words (words that are not in their ALLOWED WORDS list).
Output ONLY one JSON object. No prose, no markdown, no code fences.`;

export type PromptInput = {
  language: string;
  sentenceType: SentenceType;
  outsideWordLimit: number;
  uncountedLemmas: string[];
  activeWords: { lemma: string; meaning: string | null }[];
  message: string;
  situation: string | null;
  speaker: Speaker;
  feedback: string | null;
};

const speakerRules: Record<Speaker, string> = {
  female:
    "The speaker is a WOMAN. Use feminine forms whenever she refers to herself (je suis restée, je suis fatiguée, sono andata, estoy cansada). The listener and third parties keep their own gender (default masculine).",
  male: "The speaker is a MAN. Use masculine forms whenever he refers to himself (je suis resté, je suis fatigué, sono andato, estoy cansado).",
};

function goal(sentenceType: SentenceType, outsideWordLimit: number): string {
  if (sentenceType === "current_set") {
    return `GOAL: use ZERO new words. Write the sentence only with words from the ALLOWED WORDS list.
Priority: a listener should understand what the original says.
- Keep the main action and the key place, thing, person and time.
- If the list has no word for something important, describe it in a few words from the list,
  so that a listener can tell what it is. Do not explain at length.
- One or two simple sentences.
- Small details may be dropped, but never change the meaning, and never add information that is not in the original.
- Before you finish, check every word: if its dictionary form is not in the ALLOWED WORDS list, replace it.`;
  }
  return `GOAL: you may use at most ${outsideWordLimit} new words (words that are not in the ALLOWED WORDS list).
Priority: express the original meaning accurately and naturally, as a fluent speaker would.
- Use a new word whenever it makes the meaning clearer or more precise, especially for specific places, things and actions
  that the allowed words can only paraphrase vaguely. Do not avoid a useful new word just to keep the count low.
- Prefer versatile, high-frequency new words (useful in many future situations), not rare or advanced words.
- If you would need more than ${outsideWordLimit} new words, keep the most important ones and paraphrase the rest with allowed words.`;
}

// 毎回変わらない部分（語彙の一覧とルール）を前に、言いたいことを最後に置く。
// 前半が同じなら、AI サービス側のキャッシュが効きやすくなる。
export function buildPrompt(input: PromptInput): string {
  const rules = getLanguageRules(input.language);
  const language = rules.englishName;
  const tokenRules = [
    '- Contractions (du, au, des, nel, della, im, zum, del, al ...): one token, lemma = the preposition (de, à, in, di, zu, a ...).',
    '- A multi-word entry from the ALLOWED WORDS list (e.g. "parce que", "s\'il te plaît", "avoir besoin de", "excuse me") may be one token whose lemma is exactly the listed entry.',
    "- Reflexive verbs: lemma without the reflexive pronoun is fine; the pronoun is its own token.",
    ...rules.tokenRules.map((rule) => `- ${rule}`),
  ].join("\n");
  const budget = input.sentenceType === "current_set" ? 0 : input.outsideWordLimit;

  const prompt = `TARGET LANGUAGE: ${language}

== ALLOWED WORDS FOR THIS SENTENCE (${language}) ==
These are the words you may use to write this sentence (dictionary forms).
Content words (word: meaning):
${input.activeWords.map((word) => `${word.lemma}: ${word.meaning ?? ""}`).join("\n")}
Function words:
${input.uncountedLemmas.join(", ")}

== VOCABULARY RULES ==
- Any word in the ALLOWED WORDS list may be used freely, in any inflected/conjugated/agreed form
  (e.g. "aller" allows "vais", "allé", "irai"). Any grammar is allowed (subjunctive, conditional, past tenses...).
  Only the words themselves are restricted.
- A word whose dictionary form is not in the ALLOWED WORDS list is a NEW word.
  Count = number of DISTINCT new words (by dictionary form, not surface form).
- Proper nouns (names of people, places, countries, brands) are free: mark them kind "proper_noun".
- Numbers written with digits (6, 2024) are free: kind "number". Numbers written as words are normal words.

== GRAMMAR ==
The expression must be grammatically correct ${language}. Unnatural or simple is OK; wrong grammar is not.
The vocabulary limit restricts WHICH words you use, never HOW you inflect them: if the correct form needs an allowed word
(e.g. an auxiliary, an article, an agreement ending), you must use the correct form.
Check especially: ${rules.grammarChecks}
Workflow:
1. write "draft".
2. "vocab_check": list every content word of the draft whose dictionary form is NOT in the ALLOWED WORDS list (these are NEW). If there are more than the budget allows, rewrite the draft with allowed words / paraphrase until it fits.
3. "grammar_check": list each grammar error you find and its fix.
4. write the corrected final "expression".

== TOKENS ==
- List EVERY word of "expression" in order of appearance, including articles, pronouns and prepositions.
- "surface" = exactly as it appears in expression. "lemma" = dictionary form in ${language}.
  "meaning" = short Japanese gloss of the LEMMA (dictionary meaning, e.g. "住む" not "住んでいた").
  "kind" = "word" | "proper_noun" | "number".
  "pos" = part of speech of the lemma: noun | verb | adjective | adverb | pronoun | preposition | conjunction | other.
${tokenRules}

== OUTPUT JSON ==
{
  "draft": "first version of the ${language} text",
  "vocab_check": "NEW words in the draft and how you removed/kept them within the budget",
  "grammar_check": "short English notes: each grammar error found and how it was fixed (or 'no errors')",
  "expression": "the corrected ${language} text the learner would actually say",
  "tokens": [{ "surface": "...", "lemma": "...", "meaning": "...", "kind": "word", "pos": "verb" }],
  "full_translation": "natural Japanese translation of what the expression ACTUALLY conveys (so the learner can see what meaning survived), not the original request",
  "comment": "1-2 short Japanese sentences about MEANING only: what you worked around, what nuance was lost, or what the new words made expressible. Do not talk about counts or rules."
}

== THIS REQUEST ==
${goal(input.sentenceType, budget)}
NEW word budget: ${budget}. Do not exceed it.
${rules.hasSpeakerGender ? `\nSPEAKER: ${speakerRules[input.speaker]}\n` : ""}
SITUATION (may be empty): ${input.situation || "(none)"}

WHAT THE LEARNER WANTS TO SAY (usually Japanese):
${input.message}`;

  if (input.feedback === null) {
    return prompt;
  }
  return `${prompt}

== YOUR PREVIOUS ANSWER WAS REJECTED ==
${input.feedback}
Rewrite the answer so it satisfies every rule. Output the full JSON again.`;
}

// 作り直しのときに足す、前回の答えのどこがだめだったかの説明。
export function buildFeedback(previousExpression: string | null, problems: SentenceProblem[] | "unparsable"): string {
  if (problems === "unparsable") {
    return "Your output could not be parsed as the required JSON object. Output ONLY the JSON object.";
  }
  const lines = [`Previous expression: ${previousExpression ?? ""}`];
  for (const problem of problems) {
    if (problem.type === "suspicious_lemmas") {
      const pairs = problem.tokens.map((token) => `"${token.surface}" → "${token.lemma}"`).join(", ");
      lines.push(
        `These dictionary forms look wrong: ${pairs}. Give the real dictionary form of each word. If that dictionary form is not in the ALLOWED WORDS list, it is a NEW word.`,
      );
    }
    if (problem.type === "missing_tokens") {
      lines.push(`These words of the expression are missing from "tokens": ${problem.words.join(", ")}. Every word must be listed.`);
    }
    if (problem.type === "too_many_outside_words") {
      lines.push(
        `You used ${problem.outsideLemmas.length} new words (${problem.outsideLemmas.join(", ")}), but the limit is ${problem.limit}. Replace them with words from the ALLOWED WORDS list or paraphrase.`,
      );
    }
  }
  return lines.join("\n");
}
