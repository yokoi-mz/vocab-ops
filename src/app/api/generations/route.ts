import { z } from "zod";
import { requestGeneration } from "@/features/generation";
import { listImportedLanguages } from "@/features/vocabulary";

const requestBodySchema = z.object({
  language: z.string(),
  message: z.string().trim().min(1).max(1000),
  situation: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((value) => (value ? value : null)),
  speaker: z.enum(["female", "male"]),
});

// 文生成の依頼を受け付ける。DB に「待ち」として書き、番号を返す。実際の処理はワーカーが行う。
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const parsed = requestBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "入力の形が正しくありません。" }, { status: 400 });
  }
  if (!listImportedLanguages().includes(parsed.data.language)) {
    return Response.json({ error: "その言語のベースラインは、まだ取り込まれていません。" }, { status: 400 });
  }

  const id = requestGeneration(parsed.data);
  return Response.json({ id }, { status: 201 });
}
