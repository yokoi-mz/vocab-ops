import { recoverInterruptedGenerations, runNextGeneration } from "@/features/generation";

const idleWaitMs = 1000;

// ワーカー：待ちの文生成を見つけては、1件ずつ処理し続ける。Ctrl+C で止める。
async function main(): Promise<void> {
  recoverInterruptedGenerations();
  console.log("ワーカーを起動しました。待ちの文生成を処理します。");

  for (;;) {
    const generation = await runNextGeneration();
    if (generation === undefined) {
      await new Promise((resolve) => setTimeout(resolve, idleWaitMs));
      continue;
    }
    console.log(`文生成 ${generation.id}（${generation.language} の ${generation.seq} 回目）を処理しました。`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
