import { recoverInterruptedGenerations, runNextGeneration } from "@/features/generation";
import { enqueueVocabUpdateIfDue, recoverInterruptedVocabUpdates, runNextVocabUpdate } from "@/features/vocab-ops";
import { recordOpsEvent } from "@/shared/ops-log";

const idleWaitMs = 1000;

// ワーカー：待ちの文生成と語彙更新を見つけては、1件ずつ処理し続ける。Ctrl+C で止める。
// 文生成を先に処理する（画面で結果を待っている人がいるため）。文生成の待ちがないときに、語彙更新を処理する。
async function main(): Promise<void> {
  recoverInterruptedGenerations();
  recoverInterruptedVocabUpdates();
  console.log("ワーカーを起動しました。待ちの文生成と語彙更新を処理します。");
  recordOpsEvent({ language: null, source: "worker", referenceId: null, message: "ワーカーを起動した" });

  for (;;) {
    const generation = await runNextGeneration();
    if (generation !== undefined) {
      console.log(`文生成 ${generation.id}（${generation.language} の ${generation.seq} 回目）を処理しました。`);
      if (enqueueVocabUpdateIfDue(generation.language)) {
        console.log(`${generation.language} の語彙更新を、待ちに入れました。`);
      }
      continue;
    }

    const vocabUpdate = await runNextVocabUpdate();
    if (vocabUpdate !== undefined) {
      const { update, result } = vocabUpdate;
      console.log(
        result === null
          ? `語彙更新 ${update.id}（${update.language}）は失敗しました。`
          : `語彙更新 ${update.id}（${update.language}）：${result.outcome === "applied" ? "反映" : "見送り"}。${result.outcomeReason}`,
      );
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, idleWaitMs));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
