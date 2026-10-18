// Ops の画面の表示用の書式。

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return "";
  }
  if (seconds < 60) {
    return `${Math.round(seconds)} 秒`;
  }
  return `${Math.floor(seconds / 60)} 分 ${Math.round(seconds % 60)} 秒`;
}

export function secondsBetween(from: string | null, to: string | null): number | null {
  return from === null || to === null ? null : Math.max(0, (Date.parse(to) - Date.parse(from)) / 1000);
}

export const yenPerUsd = 150;
