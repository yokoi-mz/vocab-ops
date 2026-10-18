"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import type { GenerationDetail, Speaker } from "@/features/generation";
import { Flag } from "@/shared/ui/flag";
import { GenerationResult } from "./generation-result";
import { HistoryList } from "./history-list";
import styles from "./generate.module.css";

const pollIntervalMs = 2000;

export type LanguageOption = {
  code: string;
  name: string;
  speechLang: string;
  // 設定の画面で選んだ読み上げの声。null なら自動
  voiceName: string | null;
  hasSpeakerGender: boolean;
};

type GenerationFormProps = {
  languages: LanguageOption[];
  // URL の ?id= で指定された文生成。再読み込みしても結果を表示し続けるため
  initialGenerationId: number | null;
};

export function GenerationForm({ languages, initialGenerationId }: GenerationFormProps) {
  const [language, setLanguage] = useState(languages[0]?.code ?? "");
  const [situation, setSituation] = useState("");
  const [message, setMessage] = useState("");
  const [speaker, setSpeaker] = useState<Speaker>("female");
  // 言語ごとに、上の2つのブロックに出す文生成の番号。
  // まだ決まっていない言語（undefined）では、履歴を読んだときに、いちばん新しいものを出す
  const [shownIds, setShownIds] = useState<Record<string, number | null>>({});
  const [generation, setGeneration] = useState<GenerationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const shownId = shownIds[language] ?? null;
  const shownGeneration = generation !== null && generation.id === shownId ? generation : null;
  const isWaiting = shownId !== null && (shownGeneration === null || shownGeneration.status === "pending" || shownGeneration.status === "running");

  // URL の ?id= で開いたときは、その文生成の言語に切り替えて、その文生成を出す
  useEffect(() => {
    if (initialGenerationId === null) {
      return;
    }
    void fetch(`/api/generations/${initialGenerationId}`).then(async (response) => {
      if (response.ok) {
        const detail: GenerationDetail = await response.json();
        setLanguage(detail.language);
        setShownIds((ids) => ({ ...ids, [detail.language]: detail.id }));
      }
    });
  }, [initialGenerationId]);

  // 出す文生成を読む。作成中なら、完了か失敗になるまで数秒おきに問い合わせる
  useEffect(() => {
    window.history.replaceState(null, "", shownId === null ? "/generate" : `/generate?id=${shownId}`);
    if (shownId === null) {
      return;
    }
    let stopped = false;
    const poll = async () => {
      const response = await fetch(`/api/generations/${shownId}`);
      if (stopped || !response.ok) {
        return;
      }
      const detail: GenerationDetail = await response.json();
      setGeneration(detail);
      if (detail.status === "pending" || detail.status === "running") {
        setTimeout(poll, pollIntervalMs);
      } else {
        setHistoryRefreshKey((key) => key + 1);
      }
    };
    void poll();
    return () => {
      stopped = true;
    };
  }, [shownId]);

  // 履歴を読んだとき、まだ出すものが決まっていない言語なら、いちばん新しい文生成を出す
  function showLatestIfUndecided(items: GenerationDetail[]) {
    setShownIds((ids) => (language in ids || items.length === 0 ? ids : { ...ids, [language]: items[0].id }));
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (message.trim() === "" || isWaiting) {
      return;
    }
    setError(null);
    const response = await fetch("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, situation, message, speaker }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "依頼を送れませんでした。");
      return;
    }
    setShownIds((ids) => ({ ...ids, [language]: body.id }));
    // 送った言いたいことは、上の結果に出るので、入力欄は空にする（状況は続けて使うことが多いので残す）
    setMessage("");
  }

  function submitWithShortcut(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      void submit();
    }
  }

  const selected = languages.find((option) => option.code === language);

  return (
    <>
      <form className={`panel ${styles.form}`} onSubmit={submit}>
        <div className={styles.row}>
          <div className="segmented" role="group" aria-label="言語">
            {languages.map((option) => (
              <button
                key={option.code}
                type="button"
                aria-pressed={option.code === language}
                onClick={() => setLanguage(option.code)}
              >
                <Flag language={option.code} />
                {option.name}
              </button>
            ))}
          </div>
          {languages.find((option) => option.code === language)?.hasSpeakerGender && (
            <div className="segmented" role="group" aria-label="話し手">
              <button type="button" aria-pressed={speaker === "female"} onClick={() => setSpeaker("female")}>
                女性形
              </button>
              <button type="button" aria-pressed={speaker === "male"} onClick={() => setSpeaker("male")}>
                男性形
              </button>
            </div>
          )}
        </div>
        <label className={styles.field}>
          <span className="label">状況（なくてもよい）</span>
          <input
            className="text-input"
            value={situation}
            onChange={(event) => setSituation(event.target.value)}
            placeholder="例：同僚との雑談"
          />
        </label>
        <label className={styles.field}>
          <span className="label">言いたいこと</span>
          <textarea
            className={`text-input ${styles.textarea}`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={submitWithShortcut}
            placeholder="例：昨日、駅で財布をなくしちゃって、本当に困った。"
          />
        </label>
        <div className={styles.row}>
          <button type="submit" className="primary-button" disabled={message.trim() === "" || isWaiting}>
            {isWaiting ? (
              <>
                <span className={styles.buttonSpinner} aria-hidden="true" />
                作成中
              </>
            ) : (
              "文を作る"
            )}
          </button>
          <span className={styles.hint}>⌘ + Enter でも送れます</span>
        </div>
        {error !== null && <p className={styles.warning}>{error}</p>}
      </form>

      {shownGeneration !== null && (
        <GenerationResult
          generation={shownGeneration}
          languageName={selected?.name ?? ""}
          speechLang={selected?.speechLang ?? ""}
          voiceName={selected?.voiceName ?? null}
          showSpeaker={selected?.hasSpeakerGender ?? true}
          onDeleted={() => {
            // 消したら、残っている中でいちばん新しいものを出し直す
            setShownIds((ids) => {
              const rest = { ...ids };
              delete rest[language];
              return rest;
            });
            setHistoryRefreshKey((key) => key + 1);
          }}
        />
      )}

      <HistoryList
        language={language}
        languageName={languages.find((option) => option.code === language)?.name ?? ""}
        speechLang={languages.find((option) => option.code === language)?.speechLang ?? ""}
        voiceName={languages.find((option) => option.code === language)?.voiceName ?? null}
        showSpeaker={languages.find((option) => option.code === language)?.hasSpeakerGender ?? true}
        excludedId={shownId}
        refreshKey={historyRefreshKey}
        onLoaded={showLatestIfUndecided}
      />
    </>
  );
}
