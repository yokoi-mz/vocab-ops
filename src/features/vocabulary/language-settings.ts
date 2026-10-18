import { getDatabase } from "@/shared/db";
import { updateLanguageSettings, type LanguageSettings } from "./vocabulary-repository";

// 設定の画面から、言語の設定（読み上げの声、拡張語彙文の手札外語彙の語の数の上限、増減モード、語彙更新の幅）を変える。
// 渡されたものだけを書き換える。
export function changeLanguageSettings(language: string, settings: Partial<LanguageSettings>): void {
  updateLanguageSettings(getDatabase(), language, settings);
}
