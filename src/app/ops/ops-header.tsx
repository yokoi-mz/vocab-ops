import Link from "next/link";
import { getLanguageName } from "@/features/language";
import { Flag } from "@/shared/ui/flag";
import styles from "./ops.module.css";
import { RefreshButton } from "./refresh-button";
import { formatTime } from "./format";

type OpsHeaderProps = {
  languages: string[];
  language: string;
  current: "overview" | "logs";
};

// Ops の画面の上部：言語の切り替え、「概要／動きの記録」の切り替え、更新ボタン。
export function OpsHeader({ languages, language, current }: OpsHeaderProps) {
  const path = current === "overview" ? "/ops" : "/ops/logs";
  return (
    <div className={styles.header}>
      <div className={styles.headerLeft}>
        <nav className="segmented" aria-label="言語">
          {languages.map((code) => (
            <Link key={code} href={`${path}?language=${code}`} aria-current={code === language ? "page" : undefined}>
              <Flag language={code} />
              {getLanguageName(code)}
            </Link>
          ))}
        </nav>
        <nav className={styles.tabs} aria-label="Ops の画面">
          <Link href={`/ops?language=${language}`} aria-current={current === "overview" ? "page" : undefined}>
            概要
          </Link>
          <Link href={`/ops/logs?language=${language}`} aria-current={current === "logs" ? "page" : undefined}>
            動きの記録
          </Link>
        </nav>
      </div>
      <RefreshButton loadedAt={formatTime(new Date().toISOString())} />
    </div>
  );
}
