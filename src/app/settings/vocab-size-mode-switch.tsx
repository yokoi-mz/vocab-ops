"use client";

import { useRouter } from "next/navigation";
import type { VocabSizeMode } from "@/features/vocabulary";

const modes: { mode: VocabSizeMode; label: string }[] = [
  { mode: "increase", label: "増やす" },
  { mode: "keep", label: "変えない" },
  { mode: "decrease", label: "減らす" },
];

type VocabSizeModeSwitchProps = {
  language: string;
  current: VocabSizeMode;
  selectable: VocabSizeMode[];
};

// 増減モードの切り替え。まだ選べないモードは、押せない状態で表示する。
export function VocabSizeModeSwitch({ language, current, selectable }: VocabSizeModeSwitchProps) {
  const router = useRouter();

  async function change(mode: VocabSizeMode) {
    const response = await fetch(`/api/languages/${language}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vocabSizeMode: mode }),
    });
    if (response.ok) {
      router.refresh();
    } else {
      const body = await response.json().catch(() => ({}));
      window.alert(body.error ?? "変更できませんでした。");
    }
  }

  return (
    <div className="segmented" role="group" aria-label="増減モード">
      {modes.map(({ mode, label }) => {
        const enabled = selectable.includes(mode);
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={mode === current}
            disabled={!enabled}
            title={enabled ? undefined : "削除候補が出てきたら、選べるようになります"}
            onClick={() => void change(mode)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
