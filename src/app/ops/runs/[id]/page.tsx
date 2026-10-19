import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getLanguageName } from "@/features/language";
import { getVocabUpdateRun, type RunStep, type RunStepStatus, type VocabUpdateRun } from "@/features/vocab-ops";
import { formatDuration, formatTime, secondsBetween, yenPerUsd } from "../../format";
import styles from "../../ops.module.css";
import { RefreshButton } from "../../refresh-button";
import { StatusBadge, updateLabel, updateTone } from "../../status-badge";

type RunPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: RunPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `語彙更新 #${id}` };
}

const vocabSizeModeLabels = { increase: "増やす", keep: "変えない", decrease: "減らす" } as const;
const judgementLabels = { improved: "改善", worsened: "悪化", same: "同等" } as const;
const stepIcons: Record<RunStepStatus, string> = { done: "✓", skipped: "—", failed: "✕", running: "●", pending: "○" };

export default async function VocabUpdateRunPage({ params }: RunPageProps) {
  const { id } = await params;
  await connection();
  const run = /^\d+$/.test(id) ? getVocabUpdateRun(Number(id)) : undefined;
  if (run === undefined) {
    notFound();
  }

  return (
    <main>
      <div className={styles.header}>
        <Link href={`/ops?language=${run.language}`} className={styles.backLink}>
          ← {getLanguageName(run.language)}の語彙更新の一覧
        </Link>
        <RefreshButton loadedAt={formatTime(new Date().toISOString())} />
      </div>

      <section className={`panel ${styles.section}`}>
        <div className={styles.runTitle}>
          <h1>語彙更新 #{run.id}</h1>
          <StatusBadge tone={updateTone(run)}>{updateLabel(run)}</StatusBadge>
        </div>
        <dl className={styles.runFacts}>
          <div>
            <dt>きっかけ</dt>
            <dd>文生成 {run.triggerGenerationSeq} 回目のあと</dd>
          </div>
          <div>
            <dt>開始</dt>
            <dd>{run.startedAt === null ? "まだ" : formatTime(run.startedAt)}</dd>
          </div>
          <div>
            <dt>所要時間</dt>
            <dd>{formatDuration(secondsBetween(run.startedAt, run.finishedAt)) || "—"}</dd>
          </div>
          <div>
            <dt>増減モード</dt>
            <dd>{run.vocabSizeMode === null ? "—" : vocabSizeModeLabels[run.vocabSizeMode]}</dd>
          </div>
          <div>
            <dt>手札語彙の版</dt>
            <dd>
              {run.versionBefore ?? "—"}
              {run.versionAfter !== null ? ` → ${run.versionAfter}` : ""}
            </dd>
          </div>
          <div>
            <dt>費用</dt>
            <dd>{run.costUsd === null ? "—" : `約 ${(run.costUsd * yenPerUsd).toFixed(1)} 円`}</dd>
          </div>
        </dl>
        {(run.outcomeReason ?? run.error) && <p className={styles.runReason}>{run.outcomeReason ?? run.error}</p>}
      </section>

      <section className={`panel ${styles.section}`}>
        <h2 className={styles.sectionTitle}>ステップ</h2>
        <ol className={styles.steps}>
          {run.steps.map((step) => (
            <li key={step.key} className={`${styles.step} ${styles[`step_${step.status}`]}`}>
              <details open={step.status === "failed" || step.status === "running"}>
                <summary className={styles.stepSummary}>
                  <span className={styles.stepIcon}>{stepIcons[step.status]}</span>
                  <span className={styles.stepLabel}>{step.label}</span>
                  <span className={styles.stepBrief}>{brief(step, run)}</span>
                  <span className={styles.stepDuration}>{formatDuration(step.durationSeconds)}</span>
                </summary>
                <div className={styles.stepBody}>
                  <StepBody step={step} run={run} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

// ステップの1行の要約（閉じているときに見える部分）。
function brief(step: RunStep, run: VocabUpdateRun): string {
  const additions = run.candidates.filter((candidate) => candidate.candidateType === "addition");
  const removals = run.candidates.filter((candidate) => candidate.candidateType === "removal");
  switch (step.key) {
    case "additions":
      return `${additions.length} 語`;
    case "ranking": {
      const ranked = additions.filter((candidate) => !isUnranked(candidate.reason));
      return additions.length === 0 ? "候補なしのため不要" : `${ranked.length} 語に順位（圏外 ${additions.length - ranked.length} 語）`;
    }
    case "removals":
      return `${removals.length} 語`;
    case "proposal": {
      const add = additions.filter((candidate) => candidate.inProposal).map((candidate) => `＋${candidate.lemma}`);
      const remove = removals.filter((candidate) => candidate.inProposal).map((candidate) => `−${candidate.lemma}`);
      return [...add, ...remove].join(" ") || "なし";
    }
    case "validation":
      return run.validationPerformed ? `改善 ${run.improvedCount}・悪化 ${run.worsenedCount}・同等 ${run.sameCount}` : step.status === "skipped" ? "不要" : "";
    case "result":
      return run.outcomeReason ?? run.error ?? "";
    default:
      return "";
  }
}

// ステップを開いたときの中身。
function StepBody({ step, run }: { step: RunStep; run: VocabUpdateRun }) {
  const additions = run.candidates.filter((candidate) => candidate.candidateType === "addition");
  const removals = run.candidates.filter((candidate) => candidate.candidateType === "removal");
  const messages =
    step.messages.length > 0 ? (
      <ul className={styles.stepMessages}>
        {step.messages.map((message, index) => (
          <li key={index}>{message}</li>
        ))}
      </ul>
    ) : null;

  if (step.key === "additions" && additions.length > 0) {
    return (
      <>
        {messages}
        <p className={styles.empty}>出現回数と LLM の順位は、次の「LLM の順位付け」のステップで、上位 50 件ずつ並べて見比べられる。</p>
      </>
    );
  }
  if (step.key === "ranking" && additions.length > 0) {
    // 集計（出現回数の順）と、LLM の順位を、上位 50 件ずつ横に並べて見比べる
    const byOccurrences = [...additions].sort((a, b) => (b.occurrences ?? 0) - (a.occurrences ?? 0) || a.lemma.localeCompare(b.lemma)).slice(0, 50);
    const ranked = additions.filter((candidate) => !isUnranked(candidate.reason)).slice(0, 50);
    const rankOf = new Map(ranked.map((candidate, index) => [candidate.lemma, index + 1]));
    return (
      <>
        {messages}
        <div className={styles.compare}>
          <div>
            <h3 className={styles.compareTitle}>集計（出現回数の順・上位 50）</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>語</th>
                  <th className={styles.right}>出現</th>
                  <th className={styles.right}>LLM の順位</th>
                </tr>
              </thead>
              <tbody>
                {byOccurrences.map((candidate) => (
                  <tr key={candidate.lemma}>
                    <td className={styles.lemma}>{candidate.lemma}</td>
                    <td className={styles.right}>{candidate.occurrences ?? "—"} 回</td>
                    <td className={styles.right}>{rankOf.has(candidate.lemma) ? `${rankOf.get(candidate.lemma)} 位` : <span className={styles.muted}>圏外</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h3 className={styles.compareTitle}>LLM の順位（上位 50）</h3>
            {ranked.length === 0 ? (
              <p className={styles.empty}>LLM は、足す価値がある語を選ばなかった。</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.right}>順位</th>
                    <th>語</th>
                    <th>理由</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((candidate, index) => (
                    <tr key={candidate.lemma}>
                      <td className={styles.right}>{index + 1}</td>
                      <td className={styles.lemma}>
                        {candidate.lemma}
                        {candidate.inProposal && <StatusBadge tone="success">更新案</StatusBadge>}
                        <span className={styles.subLine}>{candidate.occurrences ?? "—"} 回</span>
                      </td>
                      <td className={styles.muted}>{candidate.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </>
    );
  }
  if (step.key === "removals" && removals.length > 0) {
    return (
      <>
        {messages}
        <table className={styles.table}>
          <tbody>
            {removals.slice(0, 20).map((candidate) => (
              <tr key={candidate.rank}>
                <td className={styles.right}>{candidate.rank}</td>
                <td className={styles.lemma}>
                  {candidate.lemma}
                  {candidate.inProposal && <StatusBadge tone="danger">更新案</StatusBadge>}
                </td>
                <td className={styles.muted}>{candidate.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }
  if (step.key === "validation" && run.validations.length > 0) {
    return (
      <>
        {messages}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>判定</th>
              <th>原文</th>
              <th>今の手札語彙文</th>
              <th>提案語彙文（更新案を反映した手札語彙）</th>
            </tr>
          </thead>
          <tbody>
            {run.validations.map((validation, index) => (
              <tr key={index}>
                <td className={styles.nowrap}>
                  {validation.judgement === null ? (
                    <span className={styles.muted}>判定なし</span>
                  ) : (
                    <StatusBadge tone={validation.judgement === "improved" ? "success" : validation.judgement === "worsened" ? "danger" : "neutral"}>
                      {judgementLabels[validation.judgement]}
                    </StatusBadge>
                  )}
                </td>
                <td>{validation.message}</td>
                <td>
                  {validation.currentSetSentence}
                  {validation.currentSetReused && <span className={styles.muted}>（使い回し）</span>}
                </td>
                <td>{validation.proposedSetSentence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }
  return messages ?? <p className={styles.empty}>記録はありません。</p>;
}

// LLM が順位に入れなかった追加候補か（記録の理由の文で見分ける）
function isUnranked(reason: string | null): boolean {
  return reason === null || reason.startsWith("LLM が、足す価値がない");
}
