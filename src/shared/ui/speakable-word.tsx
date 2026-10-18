"use client";

import type { ReactNode } from "react";
import { speak } from "./speech";

type SpeakableWordProps = {
  // 読み上げる文字
  text: string;
  lang: string;
  voiceName: string | null;
  className?: string;
  title?: string;
  children: ReactNode;
};

// 押すと、その語を読み上げる。文の中に置いても目立たないように、普段は普通の文字のまま見せる。
export function SpeakableWord({ text, lang, voiceName, className, title, children }: SpeakableWordProps) {
  return (
    <button
      type="button"
      className={`speakable${className ? ` ${className}` : ""}`}
      title={title}
      onClick={() => speak(text, lang, voiceName)}
    >
      {children}
    </button>
  );
}
