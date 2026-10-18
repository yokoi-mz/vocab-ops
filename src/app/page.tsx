import Link from "next/link";
import { connection } from "next/server";
import { getLanguageName } from "@/features/language";
import { getVocabulary, listImportedLanguages } from "@/features/vocabulary";
import styles from "./page.module.css";

export default async function HomePage() {
  await connection();
  const languages = listImportedLanguages();

  return (
    <main>
      <h1>語彙一覧</h1>
      {languages.length === 0 ? (
        <p>
          まだ言語がありません。<code>npm run import-baseline -- en</code> のように、ベースラインを取り込んでください。
        </p>
      ) : (
        <ul className={styles.languageList}>
          {languages.map((language) => {
            const { activeVocab, uncountedVocab } = getVocabulary(language);
            return (
              <li key={language}>
                <Link href={`/vocabulary/${language}`} className={styles.languageCard}>
                  <span className={styles.languageName}>{getLanguageName(language)}</span>
                  <span className={styles.counts}>
                    手札語彙 {activeVocab.length} 語・ノーカン語彙 {uncountedVocab.length} 語
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
