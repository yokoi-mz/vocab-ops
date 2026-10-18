import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { listImportedLanguages } from "@/features/vocabulary";
import { listOpsEvents, type OpsEventSource } from "@/shared/ops-log";
import { formatTime } from "../format";
import { OpsHeader } from "../ops-header";
import styles from "../ops.module.css";

export const metadata: Metadata = {
  title: "動きの記録",
};

const sources: { value: OpsEventSource | undefined; label: string }[] = [
  { value: undefined, label: "全部" },
  { value: "generation", label: "文生成" },
  { value: "vocab_update", label: "語彙更新" },
  { value: "worker", label: "ワーカー" },
];

const sourceLabels: Record<OpsEventSource, string> = { worker: "ワーカー", generation: "文生成", vocab_update: "語彙更新" };

export default async function OpsLogsPage({ searchParams }: { searchParams: Promise<{ language?: string; source?: string }> }) {
  const { language: requested, source: requestedSource } = await searchParams;
  await connection();
  const languages = listImportedLanguages();
  const language = requested !== undefined && languages.includes(requested) ? requested : languages[0];
  if (language === undefined) {
    return <p>まだ言語がありません。先にベースラインを取り込んでください。</p>;
  }
  const source = sources.find((item) => item.value === requestedSource)?.value;
  const events = listOpsEvents({ language, source, limit: 200 });

  return (
    <main>
      <OpsHeader languages={languages} language={language} current="logs" />

      <section className={`panel ${styles.section}`}>
        <div className={styles.logFilter}>
          <nav className="segmented" aria-label="種類">
            {sources.map((item) => (
              <Link
                key={item.label}
                href={`/ops/logs?language=${language}${item.value === undefined ? "" : `&source=${item.value}`}`}
                aria-current={item.value === source ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className={styles.muted}>新しい順に {events.length} 件</span>
        </div>

        {events.length === 0 ? (
          <p className={styles.empty}>まだ記録はありません。</p>
        ) : (
          <table className={styles.logTable}>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className={styles.logTime}>{formatTime(event.createdAt)}</td>
                  <td>
                    <span className={`${styles.source} ${styles[`source_${event.source}`]}`}>{sourceLabels[event.source]}</span>
                  </td>
                  <td>{event.message}</td>
                  <td className={styles.logAction}>
                    {event.source === "vocab_update" && event.referenceId !== null && (
                      <Link href={`/ops/runs/${event.referenceId}`} className={styles.actionLink}>
                        詳細 →
                      </Link>
                    )}
                    {event.source === "generation" && event.referenceId !== null && (
                      <Link href={`/generate?id=${event.referenceId}`} className={styles.actionLink}>
                        文を見る →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
