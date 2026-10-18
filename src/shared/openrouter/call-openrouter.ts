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

  let response: Response;
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
  } catch (error) {
    throw new OpenRouterError(`OpenRouter を呼べませんでした：${error instanceof Error ? error.message : String(error)}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new OpenRouterError(`OpenRouter がエラーを返しました（${response.status}）：${body.slice(0, 500)}`);
  }

  const parsed = responseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new OpenRouterError("OpenRouter の返事の形が想定と違います。");
  }
  return {
    text: parsed.data.choices[0].message.content ?? "",
    costUsd: parsed.data.usage?.cost ?? 0,
  };
}
