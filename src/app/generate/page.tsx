import type { Metadata } from "next";
import { connection } from "next/server";
import { getLanguageName, getLanguageRules } from "@/features/language";
import { getLanguageStatus, listImportedLanguages } from "@/features/vocabulary";
import { GenerationForm } from "./generation-form";

export const metadata: Metadata = {
  title: "文生成",
};

export default async function GeneratePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  await connection();
  const languages = listImportedLanguages().map((code) => ({
    code,
    name: getLanguageName(code),
    speechLang: getLanguageRules(code).speechLang,
    voiceName: getLanguageStatus(code).voiceName,
    hasSpeakerGender: getLanguageRules(code).hasSpeakerGender,
  }));

  return (
    <main>
      <h1>手札語彙で文を作る</h1>
      {languages.length === 0 ? (
        <p>まだ言語がありません。先にベースラインを取り込んでください。</p>
      ) : (
        <GenerationForm languages={languages} initialGenerationId={id !== undefined && /^\d+$/.test(id) ? Number(id) : null} />
      )}
    </main>
  );
}
