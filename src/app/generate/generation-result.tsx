"use client";

import type { GenerationDetail } from "@/features/generation";
import { SentenceCard } from "./sentence-card";
import styles from "./generate.module.css";

const yenPerUsd = 150;

type GenerationResultProps = {
  generation: GenerationDetail;
  languageName: string;
  speechLang: string;
  voiceName: string | null;
  // 話し手の性別で語形が変わる言語のときだけ、女性形・男性形を表示する
  showSpeaker: boolean;
  // 削除されたあとに呼ぶ。渡されたときだけ「この回を削除」ボタンを出す
  onDeleted?: () => void;
};

// 1回の文生成の結果（言いたいことと、手札語彙文・拡張語彙文の2枚のカード）。文生成の画面と履歴の画面で使う。
export function GenerationResult({ generation, languageName, speechLang, voiceName, showSpeaker, onDeleted }: GenerationResultProps) {
  const currentSet = generation.sentences.find((sentence) => sentence.sentenceType === "current_set");
  const expandedSet = generation.sentences.find((sentence) => sentence.sentenceType === "expanded_set");
  const isWaiting = generation.status === "pending" || generation.status === "running";

  return (
    <div>
      <div className={styles.summary}>
        <span>
          {languageName}
          {showSpeaker ? ` ・ ${generation.speaker === "female" ? "女性形" : "男性形"}` : ""}
          {generation.situation ? ` ・ ${generation.situation}` : ""} ・ 「{generation.message}」
        </span>
        {generation.costUsd !== null && generation.status === "done" && (
          <span>
            ${generation.costUsd.toFixed(4)}（約 {(generation.costUsd * yenPerUsd).toFixed(1)} 円）
          </span>
        )}
      </div>
      {isWaiting && <p className={styles.waiting}>文を作っています。10〜20 秒ほどかかります（ワーカーが動いている必要があります）。</p>}
      {generation.status === "failed" && <p className={styles.warning}>文を作れませんでした：{generation.error}</p>}
      <div className={styles.cards}>
        {currentSet !== undefined && (
          <SentenceCard
            title="手札語彙文"
            subtitle="手札語彙とノーカン語彙だけ"
            color="var(--color-mint)"
            outsideWordLimit={0}
            sentence={currentSet}
            speechLang={speechLang}
            voiceName={voiceName}
          />
        )}
        {expandedSet !== undefined && (
          <SentenceCard
            title="拡張語彙文"
            subtitle={`手札外語彙の語を ${generation.expandedOutsideWordLimit ?? "?"} 語まで`}
            color="var(--color-sky)"
            outsideWordLimit={generation.expandedOutsideWordLimit ?? 0}
            sentence={expandedSet}
            speechLang={speechLang}
            voiceName={voiceName}
          />
        )}
      </div>
      {onDeleted !== undefined && !isWaiting && (
        <div className={styles.deleteRow}>
          <button type="button" className={styles.deleteButton} onClick={() => void deleteGeneration(generation.id, onDeleted)}>
            この回を削除
          </button>
        </div>
      )}
    </div>
  );
}

// 確認してから、文生成1回分を削除する（語彙更新の回数にも数えなくなる）。
async function deleteGeneration(id: number, onDeleted: () => void): Promise<void> {
  if (!window.confirm("この回の文生成を削除します。語彙更新の回数にも数えなくなり、元に戻せません。よろしいですか？")) {
    return;
  }
  const response = await fetch(`/api/generations/${id}`, { method: "DELETE" });
  if (response.ok) {
    onDeleted();
  } else {
    const body = await response.json().catch(() => ({}));
    window.alert(body.error ?? "削除できませんでした。");
  }
}
