"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/generate", label: "文生成", matches: (path: string) => path.startsWith("/generate") },
  { href: "/", label: "語彙", matches: (path: string) => path === "/" || path.startsWith("/vocabulary") },
  { href: "/settings", label: "設定", matches: (path: string) => path.startsWith("/settings") },
];

// 上部の画面の切り替え。今いる画面のボタンを光らせる。
export function NavTabs() {
  const pathname = usePathname();
  return (
    <nav className="segmented" aria-label="画面">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.matches(pathname) ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
