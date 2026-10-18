import Link from "next/link";
import { connection } from "next/server";
import { getLanguageName } from "@/features/language";
import { getVocabulary, listImportedLanguages } from "@/features/vocabulary";
import { Flag } from "@/shared/ui/flag";
import styles from "./page.module.css";

export default async function HomePage() {
  await connection();
  const languages = listImportedLanguages();

  return (
    <main>
      <h1>語彙</h1>
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
                <Link href={`/vocabulary/${language}`} className={`panel ${styles.languageCard}`}>
                  <span className={styles.languageName}>
                    <Flag language={language} />
                    {getLanguageName(language)}
                  </span>
                  <span className={styles.counts}>
                    <strong>{activeVocab.length}</strong> 手札語彙
                    <span className={styles.separator}>・</span>
                    {uncountedVocab.length} ノーカン語彙
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
