import { getLanguageRules, type SentenceProblem } from "@/features/language";
import type { SentenceType, Speaker } from "./generation-repository";

// プロンプトを変えたら、この版を進める。文生成の記録に残し、語彙更新検証で保存済みの文を使い回せるかの判断に使う。
export const promptVersion = "2026-10-18.2";

export const systemPrompt = `You are a speaking-simulation engine for a language learner.
The learner may only use a limited set of lemmas. Your job is to express what they want to say
in the target language while respecting a strict budget of NEW lemmas (lemmas not in their lists).
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
    return `GOAL: use ZERO new lemmas. Only BASIC and ACTIVE lemmas.
Priority: get the original meaning across somehow, even if unnatural.
If something cannot be said directly: split into several short sentences, simplify, paraphrase descriptively,
take a detour, or give up minor nuances.`;
  }
  return `GOAL: you may use at most ${outsideWordLimit} new lemmas (use fewer, or 0, if enough).
Priority: keep the original meaning more precisely, sound natural, keep needed nuances, be less roundabout.
Choose new lemmas that are versatile and high-frequency (useful in many future situations),
not rare or unnecessarily advanced words. This is NOT unrestricted translation.`;
}

// 毎回変わらない部分（語彙の一覧とルール）を前に、言いたいことを最後に置く。
// 前半が同じなら、AI サービス側のキャッシュが効きやすくなる。
export function buildPrompt(input: PromptInput): string {
  const rules = getLanguageRules(input.language);
  const language = rules.englishName;
  const tokenRules = [
    '- Contractions (du, au, des, nel, della, im, zum, del, al ...): one token, lemma = the preposition (de, à, in, di, zu, a ...).',
    '- A multi-word entry from the lists (e.g. "parce que", "s\'il te plaît", "avoir besoin de", "excuse me") may be one token whose lemma is exactly the listed entry.',
    "- Reflexive verbs: lemma without the reflexive pronoun is fine; the pronoun is its own token.",
    ...rules.tokenRules.map((rule) => `- ${rule}`),
  ].join("\n");
  const budget = input.sentenceType === "current_set" ? 0 : input.outsideWordLimit;

  const prompt = `TARGET LANGUAGE: ${language}

== BASIC LEMMAS (${language}) ==
${input.uncountedLemmas.join(", ")}

== ACTIVE LEMMAS (${language}) — lemma: meaning ==
${input.activeWords.map((word) => `${word.lemma}: ${word.meaning ?? ""}`).join("\n")}

== VOCABULARY RULES ==
- Allowed without cost = BASIC lemmas ∪ ACTIVE lemmas (lists above).
- Any inflected/conjugated/agreed form of an allowed lemma is free (e.g. lemma "aller" allows "vais", "allé", "irai").
  Any grammar is allowed (subjunctive, conditional, past tenses...). Only lemmas are restricted.
- Any lemma not in the lists is NEW. Count = number of DISTINCT new lemmas (not surface forms).
- Proper nouns (names of people, places, countries, brands) are free: mark them kind "proper_noun".
- Numbers written with digits (6, 2024) are free: kind "number". Numbers written as words are normal words.

== GRAMMAR ==
The expression must be grammatically correct ${language}. Unnatural or simple is OK; wrong grammar is not.
The vocabulary limit restricts WHICH lemmas you use, never HOW you inflect them: if the correct form needs an allowed lemma
(e.g. an auxiliary, an article, an agreement ending), you must use the correct form.
Check especially: ${rules.grammarChecks}
Workflow:
1. write "draft".
2. "vocab_check": list every content lemma of the draft that is NOT in the BASIC/ACTIVE lists (these are NEW). If there are more than the budget allows, rewrite the draft with allowed lemmas / paraphrase until it fits.
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
  "vocab_check": "NEW lemmas in the draft and how you removed/kept them within the budget",
  "grammar_check": "short English notes: each grammar error found and how it was fixed (or 'no errors')",
  "expression": "the corrected ${language} text the learner would actually say",
  "tokens": [{ "surface": "...", "lemma": "...", "meaning": "...", "kind": "word", "pos": "verb" }],
  "full_translation": "natural Japanese translation of what the expression ACTUALLY conveys (so the learner can see what meaning survived), not the original request",
  "comment": "1-2 short Japanese sentences about MEANING only: what you worked around, what nuance was lost, or what the new lemmas made expressible. Do not talk about counts or rules."
}

== THIS REQUEST ==
${goal(input.sentenceType, budget)}
NEW lemma budget: ${budget}. Do not exceed it.
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
        `These lemmas look wrong: ${pairs}. Give the real dictionary form of each word. If that lemma is not in the lists, it is NEW.`,
      );
    }
    if (problem.type === "missing_tokens") {
      lines.push(`These words of the expression are missing from "tokens": ${problem.words.join(", ")}. Every word must be listed.`);
    }
    if (problem.type === "too_many_outside_words") {
      lines.push(
        `You used ${problem.outsideLemmas.length} new lemmas (${problem.outsideLemmas.join(", ")}), but the limit is ${problem.limit}. Replace some of them with BASIC/ACTIVE lemmas or paraphrase.`,
      );
    }
  }
  return lines.join("\n");
}
