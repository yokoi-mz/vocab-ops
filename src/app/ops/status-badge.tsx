import styles from "./ops.module.css";

export type BadgeTone = "success" | "neutral" | "danger" | "running";

const toneClass: Record<BadgeTone, string> = {
  success: styles.badgeSuccess,
  neutral: styles.badgeNeutral,
  danger: styles.badgeDanger,
  running: styles.badgeRunning,
};

// 状態を表す丸い印（反映・見送り・失敗・実行中など）。
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return <span className={`${styles.badge} ${toneClass[tone]}`}>{children}</span>;
}

// 語彙更新の状態を、印の文字と色にする。
export function updateLabel(update: { status: string; outcome: string | null }): string {
  if (update.status === "failed") return "失敗";
  if (update.status === "pending") return "待ち";
  if (update.status === "running") return "実行中";
  return update.outcome === "applied" ? "反映" : "見送り";
}

export function updateTone(update: { status: string; outcome: string | null }): BadgeTone {
  if (update.status === "failed") return "danger";
  if (update.status === "pending" || update.status === "running") return "running";
  return update.outcome === "applied" ? "success" : "neutral";
}
