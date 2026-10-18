import type { RecentVocabUpdate } from "@/features/vocab-ops";
import styles from "./page.module.css";

const yenPerUsd = 150;

// 最近の語彙更新。足した語・外した語と、反映したか見送ったかの理由を出す。
export function RecentUpdates({ updates }: { updates: RecentVocabUpdate[] }) {
  if (updates.length === 0) {
    return <p className={styles.note}>まだ語彙更新はありません。</p>;
  }
  return (
    <ul className={styles.updateList}>
      {updates.map((update) => (
        <li key={update.id} className={`panel ${styles.update}`}>
          <div className={styles.updateHeader}>
            <span className={styles.updateDate}>{formatDate(update.finishedAt ?? update.createdAt)}</span>
            <span className={`${styles.outcome} ${outcomeClass(update)}`}>{outcomeLabel(update)}</span>
            {update.versionBefore !== null && (
              <span className={styles.count}>
                版 {update.versionBefore}
                {update.versionAfter !== null ? ` → ${update.versionAfter}` : ""}
              </span>
            )}
            {update.costUsd !== null && <span className={styles.count}>約 {(update.costUsd * yenPerUsd).toFixed(1)} 円</span>}
          </div>
          {(update.additions.length > 0 || update.removals.length > 0) && (
            <div className={styles.updateWords}>
              {update.additions.map((word) => (
                <span key={`a-${word.lemma}`} className={styles.added} title={word.meaning ?? undefined}>
                  ＋ {word.lemma}
                </span>
              ))}
              {update.removals.map((word) => (
                <span key={`r-${word.lemma}`} className={styles.removed} title={word.meaning ?? undefined}>
                  − {word.lemma}
                </span>
              ))}
            </div>
          )}
          <p className={styles.updateReason}>{update.outcomeReason ?? update.error ?? "処理中です。"}</p>
        </li>
      ))}
    </ul>
  );
}

function outcomeLabel(update: RecentVocabUpdate): string {
  if (update.status === "failed") return "失敗";
  if (update.status !== "done") return "処理中";
  return update.outcome === "applied" ? "反映" : "見送り";
}

function outcomeClass(update: RecentVocabUpdate): string {
  if (update.status === "failed") return styles.outcomeFailed;
  return update.outcome === "applied" ? styles.outcomeApplied : "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
