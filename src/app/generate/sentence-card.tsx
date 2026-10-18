"use client";

import type { CSSProperties } from "react";
import type { GeneratedSentence, GeneratedToken } from "@/features/generation";
import { SpeakableWord } from "@/shared/ui/speakable-word";
import { speak } from "@/shared/ui/speech";
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
  subtitle: string;
  color: string;
  outsideWordLimit: number;
  sentence: GeneratedSentence;
  speechLang: string;
  voiceName: string | null;
};

export function SentenceCard({ title, subtitle, color, outsideWordLimit, sentence, speechLang, voiceName }: SentenceCardProps) {
  const problems: { type: string }[] =
    sentence.unresolvedProblemsJson === null ? [] : JSON.parse(sentence.unresolvedProblemsJson);
  const outsideCount = new Set(
    sentence.tokens.filter((token) => token.judgement === "outside").map((token) => token.lemma.toLowerCase()),
  ).size;

  return (
    <section className={`panel ${styles.card}`} style={{ "--card-color": color } as CSSProperties}>
      <header className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>{title}</h2>
          <p className={styles.cardSubtitle}>
            {subtitle}
            {sentence.attempts > 1 ? `・${sentence.attempts} 回目で完成` : ""}
          </p>
        </div>
        <span className={`${styles.badge} ${outsideCount > 0 ? styles.badgeOutside : ""}`}>
          手札外 {outsideCount} / {outsideWordLimit}
        </span>
      </header>

      <div>
        <div className={styles.labelRow}>
          <span className="label">文</span>
          <button type="button" className={styles.iconButton} onClick={() => speak(sentence.sentence, speechLang, voiceName)} aria-label="読み上げる">
            ▶︎
          </button>
        </div>
        <p className={styles.sentence} lang={speechLang}>
          {segmentSentence(sentence.sentence, sentence.tokens).map((segment, index) =>
            segment.token === null ? (
              <span key={index}>{segment.text}</span>
            ) : (
              // 単語を押すと、文の中の形のまま読み上げる
              <SpeakableWord
                key={index}
                text={segment.text}
                lang={speechLang}
                voiceName={voiceName}
                className={segment.token.judgement === "outside" ? styles.outsideWord : undefined}
                title={`${segment.token.lemma}：${segment.token.meaning ?? ""}`}
              >
                {segment.text}
              </SpeakableWord>
            ),
          )}
        </p>
      </div>

      {problems.length > 0 && (
        <p className={styles.warning}>
          作り直しの上限まで採点に通りませんでした：{problems.map((problem) => problemLabels[problem.type] ?? problem.type).join("、")}
        </p>
      )}

      <div>
        <span className="label">実際の意味</span>
        <p className={styles.box}>{sentence.translation}</p>
        <p className={styles.comment}>{sentence.comment}</p>
      </div>

      <details>
        <summary className="label">単語の内訳</summary>
        <table className={styles.tokenTable}>
          <tbody>
            {groupTokens(sentence.tokens).map((group) => (
              <tr key={`${group.lemma}-${group.judgement}`}>
                <td>
                  <button type="button" className={styles.wordButton} onClick={() => speak(group.lemma, speechLang, voiceName)}>
                    {group.lemma}
                  </button>
                </td>
                <td className={styles.muted}>{group.surfaces.join(", ")}</td>
                <td>{group.meaning}</td>
                <td className={`${styles.judgement} ${group.judgement === "outside" ? styles.judgementOutside : styles.muted}`}>
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
