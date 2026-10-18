const languageNames: Record<string, string> = {
  en: "英語",
  fr: "フランス語",
  it: "イタリア語",
  es: "スペイン語",
  de: "ドイツ語",
  sv: "スウェーデン語",
};

export function getLanguageName(code: string): string {
  return languageNames[code] ?? code;
}
