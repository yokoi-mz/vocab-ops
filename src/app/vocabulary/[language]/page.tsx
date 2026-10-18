import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLanguageName } from "@/features/language";
import { getVocabulary, listImportedLanguages, type VocabWord } from "@/features/vocabulary";
import styles from "./page.module.css";

type VocabularyPageProps = {
  params: Promise<{ language: string }>;
};

export async function generateMetadata({ params }: VocabularyPageProps): Promise<Metadata> {
  const { language } = await params;
  return { title: `${getLanguageName(language)}の語彙` };
}

export default async function VocabularyPage({ params }: VocabularyPageProps) {
  const { language } = await params;
  await connection();
  const languages = listImportedLanguages();
  if (!languages.includes(language)) {
    notFound();
  }

  const { activeVocab, uncountedVocab } = getVocabulary(language);

  return (
    <main>
      <nav className={styles.languageTabs} aria-label="言語">
        {languages.map((code) => (
          <Link
            key={code}
            href={`/vocabulary/${code}`}
            className={styles.languageTab}
            aria-current={code === language ? "page" : undefined}
          >
            {getLanguageName(code)}
          </Link>
        ))}
      </nav>

      <h1>{getLanguageName(language)}の語彙</h1>

      <h2 className={styles.sectionTitle}>
        手札語彙 <span className={styles.count}>{activeVocab.length} 語</span>
      </h2>
      <div className={styles.groups}>
        {groupByPartOfSpeech(activeVocab).map(([partOfSpeech, words]) => (
          <section key={partOfSpeech} className={styles.group}>
            <h3 className={styles.groupTitle}>
              {partOfSpeech} <span className={styles.count}>{words.length}</span>
            </h3>
            <table className={styles.wordTable}>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id}>
                    <td className={styles.lemma}>{word.lemma}</td>
                    <td className={styles.meaning}>{word.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>
        ノーカン語彙 <span className={styles.count}>{uncountedVocab.length} 語</span>
      </h2>
      <p className={styles.note}>手札語彙の数に数えない、文の骨組みの語。</p>
      <table className={`${styles.wordTable} ${styles.group}`}>
        <tbody>
          {groupByPartOfSpeech(uncountedVocab).map(([kind, words]) => (
            <tr key={kind}>
              <td className={styles.kind}>{kind}</td>
              <td className={styles.lemma}>{words.map((word) => word.lemma).join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function groupByPartOfSpeech(words: VocabWord[]): [string, VocabWord[]][] {
  const groups = new Map<string, VocabWord[]>();
  for (const word of words) {
    const key = word.partOfSpeech ?? "その他";
    groups.set(key, [...(groups.get(key) ?? []), word]);
  }
  return [...groups.entries()];
}
