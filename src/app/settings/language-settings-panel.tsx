"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { LanguageSettings } from "@/features/vocabulary";
import { Flag } from "@/shared/ui/flag";
import { listVoices, speak } from "@/shared/ui/speech";
import styles from "./page.module.css";
import { VocabSizeModeSwitch } from "./vocab-size-mode-switch";

type LanguageSettingsPanelProps = {
  language: string;
  languageName: string;
  speechLang: string;
  speechSample: string;
  settings: LanguageSettings;
  selectableModes: LanguageSettings["vocabSizeMode"][];
};

// 1つの言語の設定。変えたらすぐに保存する。
export function LanguageSettingsPanel({
  language,
  languageName,
  speechLang,
  speechSample,
  settings,
  selectableModes,
}: LanguageSettingsPanelProps) {
  const router = useRouter();
  const [voiceNames, setVoiceNames] = useState<string[]>([]);

  // ブラウザの声の一覧は、あとから読み込まれることがあるので、読み込まれたら作り直す
  useEffect(() => {
    const load = () => setVoiceNames(listVoices(speechLang).map((voice) => `${voice.name}`));
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [speechLang]);

  async function save(change: Partial<LanguageSettings>) {
    const response = await fetch(`/api/languages/${language}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    if (response.ok) {
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      window.alert(body.error ?? "保存できませんでした。");
    }
  }

  const limit = settings.expandedOutsideWordLimit;

  return (
    <section className={`panel ${styles.panel}`}>
      <h2 className={styles.languageName}>
        <Flag language={language} />
        {languageName}
      </h2>

      <div className={styles.row}>
        <div className={styles.labelColumn}>
          <span className={styles.label}>読み上げの声</span>
          <span className={styles.hint}>「自動」は、地域が合う声・高品質の声を優先して選ぶ</span>
        </div>
        <div className={styles.controls}>
          <select
            className={`text-input ${styles.select}`}
            value={settings.voiceName ?? ""}
            onChange={(event) => void save({ voiceName: event.target.value === "" ? null : event.target.value })}
          >
            <option value="">自動{voiceNames[0] ? `（${voiceNames[0]}）` : ""}</option>
            {voiceNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {settings.voiceName !== null && !voiceNames.includes(settings.voiceName) && (
              <option value={settings.voiceName}>{settings.voiceName}（このブラウザにはない）</option>
            )}
          </select>
          <button type="button" className={styles.smallButton} onClick={() => speak(speechSample, speechLang, settings.voiceName)}>
            ▶︎ 試しに聞く
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.labelColumn}>
          <span className={styles.label}>拡張語彙文の手札外語彙</span>
          <span className={styles.hint}>拡張語彙文で使ってよい、手札外語彙の語の数（1〜10）</span>
        </div>
        <div className={styles.controls}>
          <button type="button" className={styles.smallButton} disabled={limit <= 1} onClick={() => void save({ expandedOutsideWordLimit: limit - 1 })}>
            −
          </button>
          <span className={styles.number}>{limit} 語まで</span>
          <button type="button" className={styles.smallButton} disabled={limit >= 10} onClick={() => void save({ expandedOutsideWordLimit: limit + 1 })}>
            ＋
          </button>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.labelColumn}>
          <span className={styles.label}>増減モード</span>
          <span className={styles.hint}>語彙更新で、手札語彙の数をどうするか</span>
        </div>
        <div className={styles.controls}>
          <VocabSizeModeSwitch language={language} current={settings.vocabSizeMode} selectable={selectableModes} />
        </div>
      </div>
    </section>
  );
}
