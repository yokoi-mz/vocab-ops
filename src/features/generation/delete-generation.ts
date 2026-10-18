import { getDatabase } from "@/shared/db";
import { deleteGenerationRows, findGeneration } from "./generation-repository";

export type DeleteGenerationResult = "deleted" | "not_found" | "in_progress";

// 文生成1回分を、無かったことにする（記録・文・単語を DB から消す）。
// 作成中（待ち・実行中）のものは、ワーカーが書き込む途中なので消さない。
// 消した回は、語彙更新のどの回数にも数えない（語彙更新は、残っている文生成の数で数える）。
export function deleteGeneration(id: number): DeleteGenerationResult {
  const db = getDatabase();
  db.exec("BEGIN IMMEDIATE");
  try {
    const generation = findGeneration(db, id);
    if (generation === undefined) {
      db.exec("ROLLBACK");
      return "not_found";
    }
    if (generation.status === "pending" || generation.status === "running") {
      db.exec("ROLLBACK");
      return "in_progress";
    }
    deleteGenerationRows(db, id);
    db.exec("COMMIT");
    return "deleted";
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
