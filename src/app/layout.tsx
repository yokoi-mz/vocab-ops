import type { Metadata } from "next";
import { M_PLUS_Rounded_1c, Quicksand } from "next/font/google";
import Link from "next/link";
import { NavTabs } from "./nav-tabs";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: {
    template: "%s | vocab-ops",
    default: "vocab-ops",
  },
  description: "手札語彙で外国語の文を作り、よく使う語を自動で選び直すアプリ",
};

const latinFont = Quicksand({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], variable: "--font-latin" });
const roundedFont = M_PLUS_Rounded_1c({ weight: ["400", "700"], preload: false, variable: "--font-rounded" });

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${latinFont.variable} ${roundedFont.variable}`}>
      <body>
        <div className={styles.page}>
          <header className={styles.header}>
            <Link href="/" className={styles.appName}>
              <span className={styles.logoMark}>✦</span>
              vocab-ops
            </Link>
            <NavTabs />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
