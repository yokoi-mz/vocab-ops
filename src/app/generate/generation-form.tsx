"use client";

import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import type { GenerationDetail, Speaker } from "@/features/generation";
import { SentenceCard } from "./sentence-card";
import styles from "./generate.module.css";

const pollIntervalMs = 2000;
const yenPerUsd = 150;

export type LanguageOption = {
  code: string;
  name: string;
  speechLang: string;
};

export function GenerationForm({ languages }: { languages: LanguageOption[] }) {
  const [language, setLanguage] = useState(languages[0]?.code ?? "");
  const [situation, setSituation] = useState("");
  const [message, setMessage] = useState("");
  const [speaker, setSpeaker] = useState<Speaker>("female");
  const [generationId, setGenerationId] = useState<number | null>(null);
  const [generation, setGeneration] = useState<GenerationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }

  function submitWithShortcut(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      void submit();
    }
  }

  const speechLang = languages.find((option) => option.code === (generation?.language ?? language))?.speechLang ?? "";
  const sentence = (type: "current_set" | "expanded_set") => generation?.sentences.find((item) => item.sentenceType === type);
  const currentSet = sentence("current_set");
  const expandedSet = sentence("expanded_set");

  return (
    <>
      <form className={styles.form} onSubmit={submit}>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>言語</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languages.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={styles.field}>
            <legend className={styles.label}>話し手</legend>
            <label>
              <input type="radio" checked={speaker === "female"} onChange={() => setSpeaker("female")} /> 女性形
            </label>
            <label>
              <input type="radio" checked={speaker === "male"} onChange={() => setSpeaker("male")} /> 男性形
            </label>
          </fieldset>
        </div>
        <label className={styles.field}>
          <span className={styles.label}>状況（なくてもよい）</span>
          <input value={situation} onChange={(event) => setSituation(event.target.value)} placeholder="例：同僚との雑談" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>言いたいこと</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={submitWithShortcut}
            rows={3}
            placeholder="例：昨日、駅で財布をなくしちゃって、本当に困った。"
          />
        </label>
        <div className={styles.row}>
          <button type="submit" className={styles.submitButton} disabled={message.trim() === "" || isWaiting}>
            {isWaiting ? "作成中…" : "文を作る"}
          </button>
          <span className={styles.muted}>⌘ + Enter でも送れます</span>
        </div>
        {error !== null && <p className={styles.warning}>{error}</p>}
      </form>

      {generation !== null && (
        <div className={styles.result}>
          <p className={styles.muted}>
            {generation.message}
            {generation.status === "done" && generation.costUsd !== null && (
              <> ・ 費用 ${generation.costUsd.toFixed(4)}（約 {(generation.costUsd * yenPerUsd).toFixed(1)} 円）</>
            )}
          </p>
          {isWaiting && <p className={styles.muted}>文を作っています。10〜20 秒ほどかかります（ワーカーが動いている必要があります）。</p>}
          {generation.status === "failed" && <p className={styles.warning}>文を作れませんでした：{generation.error}</p>}
          {currentSet !== undefined && <SentenceCard title="手札語彙文" sentence={currentSet} speechLang={speechLang} />}
          {expandedSet !== undefined && <SentenceCard title="拡張語彙文" sentence={expandedSet} speechLang={speechLang} />}
        </div>
      )}
    </>
  );
}
