"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import styles from "./ops.module.css";

// 「更新」ボタン。押したときと、別のタブやアプリからこの画面に戻ってきたときだけ、表示を読み直す。
// 定期的には読み直さない（パソコンに負担をかけないため）。
export function RefreshButton({ loadedAt }: { loadedAt: string }) {
  const router = useRouter();

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [router]);

  return (
    <div className={styles.refresh}>
      <span className={styles.muted}>{loadedAt} 時点</span>
      <button type="button" className={styles.refreshButton} onClick={() => router.refresh()}>
        ↻ 更新
      </button>
    </div>
  );
}
