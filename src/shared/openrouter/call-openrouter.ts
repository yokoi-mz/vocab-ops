import { z } from "zod";

const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const timeoutMs = 120_000;

export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export type ChatResult = {
  text: string;
  costUsd: number;
};

export class OpenRouterError extends Error {}

const responseSchema = z.object({
  choices: z
    .array(z.object({ message: z.object({ content: z.string().nullable() }) }))
    .min(1),
  usage: z.object({ cost: z.number().optional() }).optional(),
});

// OpenRouter のチャットの API を1回呼び、返事の本文と費用（ドル）を返す。
// 推論（thinking）は切り、返事は JSON のオブジェクトにするよう指定する。
export async function callOpenRouter(model: string, messages: ChatMessage[]): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError("環境変数 OPENROUTER_API_KEY がありません。.env.local に書いてください。");
  }

  // 時間切れは、返事の本文を読んでいる途中にも起きるので、本文を読み終えるまでを try で囲む
  let response: Response;
  let body: string;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: { type: "json_object" },
        reasoning: { enabled: false },
        usage: { include: true },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    body = await response.text();
  } catch (error) {
    throw new OpenRouterError(`OpenRouter を呼べませんでした：${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    throw new OpenRouterError(`OpenRouter がエラーを返しました（${response.status}）：${body.slice(0, 500)}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new OpenRouterError("OpenRouter の返事を JSON として読めませんでした。");
  }
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new OpenRouterError("OpenRouter の返事の形が想定と違います。");
  }
  return {
    text: parsed.data.choices[0].message.content ?? "",
    costUsd: parsed.data.usage?.cost ?? 0,
  };
}
