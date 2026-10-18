import { z } from "zod";
import { selectableVocabSizeModes } from "@/features/vocab-ops";
import { changeVocabSizeMode, listImportedLanguages } from "@/features/vocabulary";

const requestBodySchema = z.object({
  vocabSizeMode: z.enum(["increase", "keep", "decrease"]),
});

// 言語の設定を変える。今は増減モードだけ。
export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!listImportedLanguages().includes(code)) {
    return Response.json({ error: "その言語はありません。" }, { status: 404 });
  }
  const parsed = requestBodySchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return Response.json({ error: "入力の形が正しくありません。" }, { status: 400 });
  }
  if (!selectableVocabSizeModes.includes(parsed.data.vocabSizeMode)) {
    return Response.json({ error: "その増減モードは、まだ選べません。" }, { status: 400 });
  }
  changeVocabSizeMode(code, parsed.data.vocabSizeMode);
  return new Response(null, { status: 204 });
}
