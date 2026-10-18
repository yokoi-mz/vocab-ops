import { getGenerationDetail } from "@/features/generation";

// 文生成の状態と結果を返す。画面は、完了か失敗になるまで数秒おきにこれを呼ぶ。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const generation = /^\d+$/.test(id) ? getGenerationDetail(Number(id)) : undefined;
  if (generation === undefined) {
    return Response.json({ error: "その文生成はありません。" }, { status: 404 });
  }
  return Response.json(generation);
}
