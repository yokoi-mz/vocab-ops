"use client";

import { useEffect, useState } from "react";
import type { GeneratedSentence, GenerationDetail } from "@/features/generation";
import { GenerationResult } from "./generation-result";
import { segmentSentence } from "./segment-sentence";
import styles from "./generate.module.css";

const pageSize = 20;

type HistoryListProps = {
  language: string;
  languageName: string;
  speechLang: string;
  voiceName: string | null;
  showSpeaker: boolean;
  // 上に表示している文生成。履歴の一覧では重ねて出さない
  excludedId: number | null;
  // 文生成が完成するたびに増える。増えたら一覧を読み直す
  refreshKey: number;
  // 一覧の最初のページを読んだときに呼ぶ（新しい順の文生成を渡す）
  onLoaded: (generations: GenerationDetail[]) => void;
};

// その言語の文生成の履歴。新しい順に並べ、行を押すと2枚のカードを開く。
export function HistoryList({ language, languageName, speechLang, voiceName, showSpeaker, excludedId, refreshKey, onLoaded }: HistoryListProps) {
  const [generations, setGenerations] = useState<GenerationDetail[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    let stopped = false;
    void fetchHistory(language, null).then((items) => {
      if (!stopped) {
        setGenerations(items);
        setHasMore(items.length === pageSize);
        onLoaded(items);
      }
    });
    return () => {
      stopped = true;
    };
    // onLoaded は、言語か refreshKey が変わって読み直したときだけ呼べばよい
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, refreshKey]);

  async function loadMore() {
    const oldest = generations.at(-1);
    if (oldest === undefined) {
      return;
    }
    const items = await fetchHistory(language, oldest.seq);
    setGenerations([...generations, ...items]);
    setHasMore(items.length === pageSize);
  }

  const visible = generations.filter((generation) => generation.id !== excludedId);

  return (
    <section className={styles.history}>
      <h2 className={styles.historyTitle}>履歴</h2>
      {visible.length === 0 && <p className={styles.hint}>{languageName}の文生成は、まだありません。</p>}
      <ul className={styles.historyList}>
        {visible.map((generation) => (
          <li key={generation.id} className={`panel ${styles.historyItem}`}>
            <button
              type="button"
              className={styles.historyRow}
              aria-expanded={openId === generation.id}
              onClick={() => setOpenId(openId === generation.id ? null : generation.id)}
            >
              <span className={styles.historyMeta}>
                {formatDate(generation.createdAt)}
                {generation.status === "failed" && <span className={styles.warning}> ・ 失敗</span>}
                {(generation.status === "pending" || generation.status === "running") && " ・ 作成中"}
              </span>
              <span className={styles.historyMessage}>{generation.message}</span>
              <HistorySentence sentence={generation.sentences.find((item) => item.sentenceType === "current_set")} />
              <HistorySentence sentence={generation.sentences.find((item) => item.sentenceType === "expanded_set")} />
            </button>
            {openId === generation.id && (
              <div className={styles.historyDetail}>
                <GenerationResult
                  generation={generation}
                  languageName={languageName}
                  speechLang={speechLang}
                  voiceName={voiceName}
                  showSpeaker={showSpeaker}
                  onDeleted={() => setGenerations(generations.filter((item) => item.id !== generation.id))}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      {hasMore && (
        <button type="button" className={styles.moreButton} onClick={() => void loadMore()}>
          もっと見る
        </button>
      )}
    </section>
  );
}

function HistorySentence({ sentence }: { sentence: GeneratedSentence | undefined }) {
  if (sentence === undefined) {
    return null;
  }
  return (
    <span className={styles.historySentence}>
      <span className={sentence.sentenceType === "current_set" ? styles.historyDotCurrent : styles.historyDotExpanded} />
      <span>
        {segmentSentence(sentence.sentence, sentence.tokens).map((segment, index) => (
          <span key={index} className={segment.token?.judgement === "outside" ? styles.outsideWord : undefined}>
            {segment.text}
          </span>
        ))}
      </span>
    </span>
  );
}

async function fetchHistory(language: string, beforeSeq: number | null): Promise<GenerationDetail[]> {
  const params = new URLSearchParams({ language, limit: String(pageSize) });
  if (beforeSeq !== null) {
    params.set("before", String(beforeSeq));
  }
  const response = await fetch(`/api/generations?${params}`);
  return response.ok ? response.json() : [];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
