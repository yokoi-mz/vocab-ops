import { z } from "zod";
import { getDatabase } from "@/shared/db";

// 裏で行われた動きの記録（Ops の画面に表示する）。業務の知識は持たず、渡されたものをそのまま書く。

export type OpsEventSource = "worker" | "generation" | "vocab_update";

export type OpsEventInput = {
  // どの言語の出来事か（ワーカーの起動など、言語に関係ないものは null）
  language: string | null;
  source: OpsEventSource;
  // 関係する行の番号（文生成の番号、語彙更新の番号）
  referenceId: number | null;
  message: string;
  detail?: unknown;
};

export function recordOpsEvent(event: OpsEventInput): void {
  getDatabase()
    .prepare(`
      INSERT INTO ops_events (language, source, reference_id, message, detail_json)
      VALUES (:language, :source, :referenceId, :message, :detailJson)
    `)
    .run({
      language: event.language,
      source: event.source,
      referenceId: event.referenceId,
      message: event.message,
      detailJson: event.detail === undefined ? null : JSON.stringify(event.detail),
    });
}

const eventRowSchema = z.object({
  id: z.number(),
  language: z.string().nullable(),
  source: z.enum(["worker", "generation", "vocab_update"]),
  reference_id: z.number().nullable(),
  message: z.string(),
  detail_json: z.string().nullable(),
  created_at: z.string(),
});

export type OpsEvent = {
  id: number;
  language: string | null;
  source: OpsEventSource;
  referenceId: number | null;
  message: string;
  detail: unknown;
  createdAt: string;
};

export type OpsEventQuery = {
  // この言語の出来事と、言語に関係ない出来事（ワーカーの起動など）を返す
  language: string;
  // 指定すれば、その種類だけ
  source?: OpsEventSource;
  // 指定すれば、その行（文生成・語彙更新）に関係する出来事だけ
  referenceId?: number;
  limit: number;
  // 古い順に返すか（ステップの並びを作るときに使う）。指定しなければ新しい順
  oldestFirst?: boolean;
};

export function listOpsEvents(query: OpsEventQuery): OpsEvent[] {
  const conditions = ["(language = :language OR language IS NULL)"];
  if (query.source !== undefined) {
    conditions.push("source = :source");
  }
  if (query.referenceId !== undefined) {
    conditions.push("reference_id = :referenceId");
  }
  return getDatabase()
    .prepare(`
      SELECT id, language, source, reference_id, message, detail_json, created_at FROM ops_events
      WHERE ${conditions.join(" AND ")}
      ORDER BY id ${query.oldestFirst ? "ASC" : "DESC"} LIMIT :limit
    `)
    .all({
      language: query.language,
      limit: query.limit,
      ...(query.source !== undefined ? { source: query.source } : {}),
      ...(query.referenceId !== undefined ? { referenceId: query.referenceId } : {}),
    })
    .map((row) => {
      const event = eventRowSchema.parse(row);
      return {
        id: event.id,
        language: event.language,
        source: event.source,
        referenceId: event.reference_id,
        message: event.message,
        detail: event.detail_json === null ? null : JSON.parse(event.detail_json),
        createdAt: event.created_at,
      };
    });
}
