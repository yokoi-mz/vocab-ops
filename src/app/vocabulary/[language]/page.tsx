import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import type { CSSProperties } from "react";
import { getLanguageName } from "@/features/language";
import { countGenerationsUntilNextUpdate, listRecentVocabUpdates } from "@/features/vocab-ops";
import { getLanguageStatus, getVocabulary, listImportedLanguages, type VocabWord } from "@/features/vocabulary";
import { Flag } from "@/shared/ui/flag";
import styles from "./page.module.css";
import { RecentUpdates } from "./recent-updates";

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
  const status = getLanguageStatus(language);
  const generationsUntilNextUpdate = countGenerationsUntilNextUpdate(language);
  const recentUpdates = listRecentVocabUpdates(language, 5);
  // 最近の語彙更新で足した語（今の版で手札語彙に入った語）に印を付ける。ベースライン（版1）の語には付けない
  const isNew = (word: VocabWord) => status.activeVocabVersion > 1 && word.addedVersion === status.activeVocabVersion;

  return (
    <main>
      <div className={styles.titleRow}>
        <nav className="segmented" aria-label="言語">
          {languages.map((code) => (
            <Link key={code} href={`/vocabulary/${code}`} aria-current={code === language ? "page" : undefined}>
              <Flag language={code} />
              {getLanguageName(code)}
            </Link>
          ))}
        </nav>
        <p className={styles.stats}>
          <strong>{activeVocab.length}</strong> 手札語彙
          <span className={styles.separator}>/</span>
          {uncountedVocab.length} ノーカン語彙
        </p>
      </div>

      <div className={`panel ${styles.opsRow}`}>
        <span className={styles.opsLabel}>増減モード</span>
        <span className={styles.opsMode}>{vocabSizeModeLabels[status.vocabSizeMode]}</span>
        <Link href="/settings" className={styles.opsLink}>
          設定で変える
        </Link>
        <span className={styles.opsNext}>
          次の語彙更新まで、あと <strong>{generationsUntilNextUpdate}</strong> 回の文生成
        </span>
      </div>

      <h2 className={styles.sectionTitle}>最近の語彙更新</h2>
      <RecentUpdates updates={recentUpdates} />

      <h2 className={styles.sectionTitle}>手札語彙</h2>
      <div className={styles.groups}>
        {groupByPartOfSpeech(activeVocab).map(([partOfSpeech, words]) => (
          <section
            key={partOfSpeech}
            className={`panel ${styles.group}`}
            style={{ "--part-of-speech-color": partOfSpeechColor(partOfSpeech) } as CSSProperties}
          >
            <h3 className={styles.groupTitle}>
              <span className={styles.dot} />
              {partOfSpeech}
              <span className={styles.count}>{words.length}</span>
            </h3>
            <table className={styles.wordTable}>
              <tbody>
                {words.map((word) => (
                  <tr key={word.id}>
                    <td className={styles.lemma}>
                      {word.lemma}
                      {isNew(word) && <span className={styles.newBadge}>NEW</span>}
                    </td>
                    <td className={styles.meaning}>{word.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>ノーカン語彙</h2>
      <p className={styles.note}>手札語彙の数に数えない、文の骨組みの語。</p>
      <div className={`panel ${styles.uncounted}`}>
        <table className={styles.wordTable}>
          <tbody>
            {groupByPartOfSpeech(uncountedVocab).map(([kind, words]) => (
              <tr key={kind}>
                <td className={styles.kind}>{kind}</td>
                <td className={styles.lemma}>{words.map((word) => word.lemma).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

const vocabSizeModeLabels = { increase: "増やす", keep: "変えない", decrease: "減らす" } as const;

function groupByPartOfSpeech(words: VocabWord[]): [string, VocabWord[]][] {
  const groups = new Map<string, VocabWord[]>();
  for (const word of words) {
    const key = toPartOfSpeechHeading(word.partOfSpeech ?? "その他", [...groups.keys()]);
    groups.set(key, [...(groups.get(key) ?? []), word]);
  }
  return [...groups.entries()];
}

// 語彙更新で足した語の品詞は、文生成のときに AI が英語で付けたもの（noun など）なので、
// ベースラインの品詞の見出し（名詞、副詞・数量・その他 など）のうち、合うものにまとめる。
const japanesePartsOfSpeech: Record<string, string> = {
  noun: "名詞",
  verb: "動詞",
  adjective: "形容詞",
  adverb: "副詞",
};

function toPartOfSpeechHeading(partOfSpeech: string, headings: string[]): string {
  const japanese = japanesePartsOfSpeech[partOfSpeech];
  if (japanese === undefined) {
    return partOfSpeech;
  }
  return headings.find((heading) => heading.startsWith(japanese)) ?? japanese;
}

// 品詞の見出しごとの色（旧版の品詞の色に合わせる）
function partOfSpeechColor(partOfSpeech: string): string {
  if (partOfSpeech.startsWith("動詞")) return "var(--color-pink)";
  if (partOfSpeech.startsWith("名詞")) return "var(--color-sky)";
  if (partOfSpeech.startsWith("形容詞")) return "var(--color-lemon)";
  if (partOfSpeech.startsWith("副詞")) return "var(--color-lavender)";
  if (partOfSpeech.startsWith("間投詞")) return "var(--color-mint)";
  return "var(--color-peach)";
}
