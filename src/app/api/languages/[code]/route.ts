import { z } from "zod";
import { listSelectableVocabSizeModes } from "@/features/vocab-ops";
import { changeLanguageSettings, listImportedLanguages } from "@/features/vocabulary";

const requestBodySchema = z
  .object({
    vocabSizeMode: z.enum(["increase", "keep", "decrease"]),
    voiceName: z.string().min(1).max(200).nullable(),
    expandedOutsideWordLimit: z.number().int().min(1).max(10),
  })
  .partial();

// 言語の設定（増減モード、読み上げの声、拡張語彙文の手札外語彙の語の数の上限）を変える。送られたものだけを変える。
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!listImportedLanguages().includes(code)) {
    return Response.json({ error: "その言語はありません。" }, { status: 404 });
  }
  const parsed = requestBodySchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return Response.json({ error: "入力の形が正しくありません。" }, { status: 400 });
  }
  const { vocabSizeMode } = parsed.data;
  if (vocabSizeMode !== undefined && !listSelectableVocabSizeModes(code).includes(vocabSizeMode)) {
    return Response.json({ error: "その増減モードは、まだ選べません。" }, { status: 400 });
  }
  changeLanguageSettings(code, parsed.data);
  return new Response(null, { status: 204 });
}
