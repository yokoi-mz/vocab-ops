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
  const [generationId, setGenerationId] = useState<number | null>(initialGenerationId);
  const [generation, setGeneration] = useState<GenerationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const isWaiting = generationId !== null && (generation === null || generation.status === "pending" || generation.status === "running");

  // 依頼を送ったら、完了か失敗になるまで数秒おきに結果を問い合わせる
  useEffect(() => {
    if (generationId === null) {
      return;
    }
    let stopped = false;
    const poll = async () => {
      const response = await fetch(`/api/generations/${generationId}`);
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
  }, [generationId]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (message.trim() === "" || isWaiting) {
      return;
    }
    setError(null);
    setGeneration(null);
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
    setGenerationId(body.id);
    window.history.replaceState(null, "", `/generate?id=${body.id}`);
  }

  function submitWithShortcut(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      void submit();
    }
  }

  const selected = languages.find((option) => option.code === (generation?.language ?? language));

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
            {isWaiting ? "作成中…" : "文を作る"}
          </button>
          <span className={styles.hint}>⌘ + Enter でも送れます</span>
        </div>
        {error !== null && <p className={styles.warning}>{error}</p>}
      </form>

      {generation !== null && (
        <GenerationResult
          generation={generation}
          languageName={selected?.name ?? ""}
          speechLang={selected?.speechLang ?? ""}
          showSpeaker={selected?.hasSpeakerGender ?? true}
          onDeleted={() => {
            setGenerationId(null);
            setGeneration(null);
            window.history.replaceState(null, "", "/generate");
          }}
        />
      )}

      <HistoryList
        language={language}
        languageName={languages.find((option) => option.code === language)?.name ?? ""}
        speechLang={languages.find((option) => option.code === language)?.speechLang ?? ""}
        showSpeaker={languages.find((option) => option.code === language)?.hasSpeakerGender ?? true}
        excludedId={generation?.language === language ? generation.id : null}
        refreshKey={historyRefreshKey}
      />
    </>
  );
}
