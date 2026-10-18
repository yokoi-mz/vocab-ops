import { deleteGeneration, getGenerationDetail } from "@/features/generation";

// 文生成の状態と結果を返す。画面は、完了か失敗になるまで数秒おきにこれを呼ぶ。
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const generation = /^\d+$/.test(id) ? getGenerationDetail(Number(id)) : undefined;
  if (generation === undefined) {
    return Response.json({ error: "その文生成はありません。" }, { status: 404 });
  }
  return Response.json(generation);
}

// 文生成1回分を消す。作成中なら 409 を返す。
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = /^\d+$/.test(id) ? deleteGeneration(Number(id)) : "not_found";
  if (result === "not_found") {
    return Response.json({ error: "その文生成はありません。" }, { status: 404 });
  }
  if (result === "in_progress") {
    return Response.json({ error: "作成中の文生成は、完了してから削除してください。" }, { status: 409 });
  }
  return new Response(null, { status: 204 });
}
