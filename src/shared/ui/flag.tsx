import type { ReactNode } from "react";

// 言語の国旗（SVG）。絵文字の国旗は OS によって表示が違うため、自前で描く。
// 言語を追加したら flags に1つ足す。ないときは言語コードの文字で表示する。
const flags: Record<string, ReactNode> = {
  en: (
    <>
      <rect width="3" height="2" fill="#012169" />
      <path d="M0,0 L3,2 M3,0 L0,2" stroke="#FFFFFF" strokeWidth="0.4" />
      <path d="M0,0 L3,2 M3,0 L0,2" stroke="#C8102E" strokeWidth="0.14" />
      <path d="M1.5,0 V2 M0,1 H3" stroke="#FFFFFF" strokeWidth="0.6" />
      <path d="M1.5,0 V2 M0,1 H3" stroke="#C8102E" strokeWidth="0.34" />
    </>
  ),
  fr: (
    <>
      <rect width="1" height="2" fill="#0055A4" />
      <rect x="1" width="1" height="2" fill="#FFFFFF" />
      <rect x="2" width="1" height="2" fill="#EF4135" />
    </>
  ),
  it: (
    <>
      <rect width="1" height="2" fill="#009246" />
      <rect x="1" width="1" height="2" fill="#FFFFFF" />
      <rect x="2" width="1" height="2" fill="#CE2B37" />
    </>
  ),
  es: (
    <>
      <rect width="3" height="2" fill="#AA151B" />
      <rect y="0.5" width="3" height="1" fill="#F1BF00" />
    </>
  ),
  de: (
    <>
      <rect width="3" height="0.667" fill="#000000" />
      <rect y="0.667" width="3" height="0.667" fill="#DD0000" />
      <rect y="1.333" width="3" height="0.667" fill="#FFCE00" />
    </>
  ),
  sv: (
    <>
      <rect width="3" height="2" fill="#006AA7" />
      <rect x="0.9" width="0.36" height="2" fill="#FECC00" />
      <rect y="0.82" width="3" height="0.36" fill="#FECC00" />
    </>
  ),
};

export function Flag({ language }: { language: string }) {
  const flag = flags[language];
  if (flag === undefined) {
    return <span style={{ fontSize: 11, fontWeight: 700 }}>{language.toUpperCase()}</span>;
  }
  return (
    <svg
      viewBox="0 0 3 2"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ width: 21, height: 14, borderRadius: 3, flex: "none", boxShadow: "0 0 0 1px rgb(255 255 255 / 0.15)" }}
    >
      {flag}
    </svg>
  );
}
