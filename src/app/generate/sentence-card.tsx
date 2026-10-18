"use client";

import type { GeneratedSentence, GeneratedToken } from "@/features/generation";
import { segmentSentence } from "./segment-sentence";
import styles from "./generate.module.css";

const judgementLabels: Record<GeneratedToken["judgement"], string> = {
  active: "手札語彙",
  uncounted: "ノーカン語彙",
  outside: "手札外語彙",
  proper_or_number: "固有名詞・数字",
};

const problemLabels: Record<string, string> = {
  too_many_outside_words: "手札外語彙の語が上限を超えている",
  missing_tokens: "単語の書き出しに漏れがある",
  suspicious_lemmas: "辞書形の取り違えが疑われる",
};

type SentenceCardProps = {
  title: string;
  sentence: GeneratedSentence;
  speechLang: string;
};

export function SentenceCard({ title, sentence, speechLang }: SentenceCardProps) {
  const problems: { type: string }[] =
    sentence.unresolvedProblemsJson === null ? [] : JSON.parse(sentence.unresolvedProblemsJson);
  const outsideCount = new Set(
    sentence.tokens.filter((token) => token.judgement === "outside").map((token) => token.lemma.toLowerCase()),
  ).size;

  return (
    <section className={styles.card}>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        <span className={styles.muted}>
          手札外語彙 {outsideCount} 語{sentence.attempts > 1 ? `・${sentence.attempts} 回目で完成` : ""}
        </span>
      </header>

      <p className={styles.sentence} lang={speechLang}>
        {segmentSentence(sentence.sentence, sentence.tokens).map((segment, index) => (
          <span
            key={index}
            className={segment.token?.judgement === "outside" ? styles.outsideWord : undefined}
            title={segment.token ? `${segment.token.lemma}：${segment.token.meaning ?? ""}` : undefined}
          >
            {segment.text}
          </span>
        ))}
        <button type="button" className={styles.speakButton} onClick={() => speak(sentence.sentence, speechLang)} aria-label="読み上げる">
          ▶︎
        </button>
      </p>

      {problems.length > 0 && (
        <p className={styles.warning}>
          作り直しの上限まで採点に通りませんでした：{problems.map((problem) => problemLabels[problem.type] ?? problem.type).join("、")}
        </p>
      )}

      <dl className={styles.details}>
        <dt>実際の意味</dt>
        <dd>{sentence.translation}</dd>
        <dt>コメント</dt>
        <dd>{sentence.comment}</dd>
      </dl>

      <details>
        <summary className={styles.muted}>単語の内訳</summary>
        <table className={styles.tokenTable}>
          <tbody>
            {groupTokens(sentence.tokens).map((group) => (
              <tr key={`${group.lemma}-${group.judgement}`}>
                <td>
                  <button type="button" className={styles.wordButton} onClick={() => speak(group.lemma, speechLang)}>
                    {group.lemma}
                  </button>
                </td>
                <td className={styles.muted}>{group.surfaces.join(", ")}</td>
                <td>{group.meaning}</td>
                <td className={group.judgement === "outside" ? styles.outsideLabel : styles.muted}>
                  {judgementLabels[group.judgement]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

// 同じ辞書形・同じ判定の語は1行にまとめ、表層形を並べる。
function groupTokens(tokens: GeneratedToken[]) {
  const groups = new Map<string, { lemma: string; meaning: string | null; judgement: GeneratedToken["judgement"]; surfaces: string[] }>();
  for (const token of tokens) {
    const key = `${token.lemma.toLowerCase()}|${token.judgement}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, { lemma: token.lemma, meaning: token.meaning, judgement: token.judgement, surfaces: [token.surface] });
    } else if (!group.surfaces.includes(token.surface)) {
      group.surfaces.push(token.surface);
    }
  }
  return [...groups.values()];
}

function speak(text: string, lang: string): void {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.95;
  const voice = speechSynthesis.getVoices().find((candidate) => candidate.lang === lang);
  if (voice !== undefined) {
    utterance.voice = voice;
  }
  speechSynthesis.speak(utterance);
}
