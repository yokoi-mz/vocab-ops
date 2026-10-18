import type { Metadata } from "next";
import { connection } from "next/server";
import { getLanguageName, getLanguageRules } from "@/features/language";
import { selectableVocabSizeModes } from "@/features/vocab-ops";
import { getLanguageStatus, listImportedLanguages } from "@/features/vocabulary";
import { LanguageSettingsPanel } from "./language-settings-panel";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "設定",
};

export default async function SettingsPage() {
  await connection();
  const languages = listImportedLanguages();

  return (
    <main>
      <h1>設定</h1>
      {languages.length === 0 && <p>まだ言語がありません。先にベースラインを取り込んでください。</p>}
      <div className={styles.panels}>
        {languages.map((language) => {
          const status = getLanguageStatus(language);
          const rules = getLanguageRules(language);
          return (
            <LanguageSettingsPanel
              key={language}
              language={language}
              languageName={getLanguageName(language)}
              speechLang={rules.speechLang}
              speechSample={rules.speechSample}
              settings={{
                voiceName: status.voiceName,
                expandedOutsideWordLimit: status.expandedOutsideWordLimit,
                vocabSizeMode: status.vocabSizeMode,
              }}
              selectableModes={selectableVocabSizeModes}
            />
          );
        })}
      </div>
    </main>
  );
}
