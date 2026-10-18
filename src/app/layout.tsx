import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: {
    template: "%s | vocab-ops",
    default: "vocab-ops",
  },
  description: "手札語彙で外国語の文を作り、よく使う語を自動で選び直すアプリ",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>
        <header className={styles.header}>
          <Link href="/" className={styles.appName}>
            vocab-ops
          </Link>
        </header>
        <div className={styles.content}>{children}</div>
      </body>
    </html>
  );
}
