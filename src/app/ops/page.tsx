import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { countUnfinishedGenerations } from "@/features/generation";
import {
  countGenerationsUntilNextUpdate,
  getAdditionTally,
  isPausedAtBaseline,
  listRecentVocabUpdates,
  listRemovalWatch,
  vocabOpsSettings,
  type RecentVocabUpdate,
} from "@/features/vocab-ops";
import { getActiveVocabSizeHistory, getLanguageStatus, getVocabulary, listImportedLanguages } from "@/features/vocabulary";
import { listOpsEvents } from "@/shared/ops-log";
import { formatDuration, formatTime, secondsBetween, yenPerUsd } from "./format";
import { OpsHeader } from "./ops-header";
import styles from "./ops.module.css";
import { StatusBadge, updateLabel, updateTone } from "./status-badge";
import { VocabSizeChart } from "./vocab-size-chart";

export const metadata: Metadata = {
  title: "Ops",
};

const vocabSizeModeLabels = { increase: "増やす", keep: "変えない", decrease: "減らす" } as const;

export default async function OpsOverviewPage({ searchParams }: { searchParams: Promise<{ language?: string }> }) {
  const { language: requested } = await searchParams;
  await connection();
  const languages = listImportedLanguages();
  const language = requested !== undefined && languages.includes(requested) ? requested : languages[0];
  if (language === undefined) {
    return <p>まだ言語がありません。先にベースラインを取り込んでください。</p>;
  }

  const status = getLanguageStatus(language);
  const activeCount = getVocabulary(language).activeVocab.length;
  const untilNext = countGenerationsUntilNextUpdate(language);
  const paused = isPausedAtBaseline(status.vocabSizeMode, status.activeVocabVersion);
  const progress = vocabOpsSettings.generationsPerUpdate - untilNext;
  const unfinishedGenerations = countUnfinishedGenerations(language);
  const updates = listRecentVocabUpdates(language, 20);
  const latestUpdate = updates[0];
  const lastActivity = listOpsEvents({ language, limit: 1 })[0];
  const tally = getAdditionTally(language);
  const removalWatch = listRemovalWatch(language, 8);

  return (
    <main>
      <OpsHeader languages={languages} language={language} current="overview" />

      <div className={styles.cards}>
        <div className={`panel ${styles.card}`}>
          <span className={styles.cardLabel}>次の語彙更新まで</span>
          <span className={styles.cardValue}>
            あと <strong>{untilNext}</strong> 回
          </span>
          <span className={styles.gauge}>
            <span className={styles.gaugeFill} style={{ width: `${(progress / vocabOpsSettings.generationsPerUpdate) * 100}%` }} />
          </span>
          <span className={styles.cardSub}>
            {paused
              ? "ベースラインのまま「変えない」モードなので、語彙更新は止めている。設定で「増やす」にすると動き始める"
              : `前回から ${progress} / ${vocabOpsSettings.generationsPerUpdate} 回の文生成`}
          </span>
        </div>
        {latestUpdate === undefined ? (
          <div className={`panel ${styles.card}`}>
            <span className={styles.cardLabel}>最後の語彙更新</span>
            <span className={styles.cardValue}>まだない</span>
          </div>
        ) : (
          <Link href={`/ops/runs/${latestUpdate.id}`} className={`panel ${styles.card} ${styles.cardLink}`}>
            <span className={styles.cardLabel}>最後の語彙更新 #{latestUpdate.id} →</span>
            <span className={styles.cardValue}>
              <StatusBadge tone={updateTone(latestUpdate)}>{updateLabel(latestUpdate)}</StatusBadge>
              <WordChanges update={latestUpdate} />
            </span>
            <span className={styles.cardSub}>{formatTime(latestUpdate.finishedAt ?? latestUpdate.createdAt)}</span>
          </Link>
        )}
        <div className={`panel ${styles.card}`}>
          <span className={styles.cardLabel}>手札語彙</span>
          <span className={styles.cardValue}>
            <strong>{activeCount}</strong> 語
          </span>
          <span className={styles.cardSub}>
            版 {status.activeVocabVersion} ・ 増減モード {vocabSizeModeLabels[status.vocabSizeMode]}
          </span>
        </div>
        <div className={`panel ${styles.card}`}>
          <span className={styles.cardLabel}>最後の動き</span>
          <span className={styles.cardValue}>{lastActivity === undefined ? "記録なし" : formatTime(lastActivity.createdAt)}</span>
          <span className={styles.cardSub}>待ち・作成中の文生成 {unfinishedGenerations} 件</span>
        </div>
      </div>

      <section className={`panel ${styles.section}`}>
        <h2 className={styles.sectionTitle}>手札語彙の語数の移り変わり</h2>
        <VocabSizeChart history={getActiveVocabSizeHistory(language)} currentSeq={status.lastGenerationSeq} currentSize={activeCount} />
      </section>

      <section className={`panel ${styles.section}`}>
        <h2 className={styles.sectionTitle}>語彙更新の一覧</h2>
        {updates.length === 0 ? (
          <p className={styles.empty}>
            まだ語彙更新はありません。文生成が {vocabOpsSettings.generationsPerUpdate} 回たまると、自動で始まります。
          </p>
        ) : (
          <table className={styles.runTable}>
            <thead>
              <tr>
                <th>状態</th>
                <th>語彙更新</th>
                <th>変わった語</th>
                <th className={styles.wideOnly}>開始</th>
                <th className={styles.wideOnly}>所要時間</th>
                <th className={styles.wideOnly}>費用</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((update) => (
                <tr key={update.id}>
                  <td>
                    <StatusBadge tone={updateTone(update)}>{updateLabel(update)}</StatusBadge>
                  </td>
                  <td className={styles.runName}>
                    <Link href={`/ops/runs/${update.id}`} className={styles.runLink}>
                      #{update.id}
                    </Link>
                    <span className={styles.muted}> 文生成 {update.triggerGenerationSeq} 回目のあと</span>
                  </td>
                  <td>
                    <WordChanges update={update} />
                  </td>
                  <td className={`${styles.nowrap} ${styles.wideOnly}`}>{formatTime(update.startedAt ?? update.createdAt)}</td>
                  <td className={`${styles.nowrap} ${styles.wideOnly}`}>{formatDuration(secondsBetween(update.startedAt, update.finishedAt))}</td>
                  <td className={`${styles.nowrap} ${styles.wideOnly}`}>{update.costUsd === null ? "" : `約 ${(update.costUsd * yenPerUsd).toFixed(1)} 円`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <h2 className={styles.groupTitle}>次の語彙更新の材料（今の時点）</h2>
      <div className={styles.columns}>
        <section className={`panel ${styles.section}`}>
          <h3 className={styles.sectionTitle}>追加候補の集計</h3>
          <p className={styles.note}>直近 {vocabOpsSettings.additionWindow} 件の拡張語彙文に出た、手札外語彙の語。次の語彙更新で、LLM がこの中から順位を付ける。</p>
          {tally.length === 0 ? (
            <p className={styles.empty}>まだありません。</p>
          ) : (
            <table className={styles.table}>
              <tbody>
                {tally.slice(0, 10).map((candidate) => (
                  <tr key={candidate.wordId}>
                    <td className={styles.lemma}>{candidate.lemma}</td>
                    <td className={styles.muted}>{candidate.meaning}</td>
                    <td className={styles.right}>{candidate.occurrences} 回</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className={`panel ${styles.section}`}>
          <h3 className={styles.sectionTitle}>削除候補に近い語</h3>
          <p className={styles.note}>
            入ってから {vocabOpsSettings.removalMinGenerationsSinceAdded} 回以上の文生成があり、直近 {vocabOpsSettings.removalRecentWindow} 回で使われていない語が、削除候補になる。
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>語</th>
                <th className={styles.right}>入ってから</th>
                <th className={styles.right}>直近の使用</th>
              </tr>
            </thead>
            <tbody>
              {removalWatch.map((item) => (
                <tr key={item.wordId}>
                  <td className={styles.lemma}>
                    {item.lemma}
                    {item.isCandidate && <StatusBadge tone="danger">削除候補</StatusBadge>}
                  </td>
                  <td className={styles.right}>
                    {item.evidence.generationsSinceAdded} / {vocabOpsSettings.removalMinGenerationsSinceAdded} 回
                  </td>
                  <td className={styles.right}>{item.evidence.recentUses} 回</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function WordChanges({ update }: { update: RecentVocabUpdate }) {
  if (update.additions.length === 0 && update.removals.length === 0) {
    return <span className={styles.muted}>なし</span>;
  }
  return (
    <span className={styles.wordChanges}>
      {update.additions.map((word) => (
        <span key={`a-${word.lemma}`} className={styles.added}>
          ＋{word.lemma}
        </span>
      ))}
      {update.removals.map((word) => (
        <span key={`r-${word.lemma}`} className={styles.removed}>
          −{word.lemma}
        </span>
      ))}
    </span>
  );
}
