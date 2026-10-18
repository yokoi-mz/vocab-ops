// 語彙更新の数値。docs/vocab-ops/parameters.md と同じ値にする。
// 値を変えたら、parameters.md の「変更履歴」に理由とともに残す。
// 語彙更新のたびに、この値を記録（vocab_updates.settings_json）に残す。
export const vocabOpsSettings = {
  // 語彙更新の実行の間隔（言語ごと、前回の語彙更新から何回の文生成ごとか）
  generationsPerUpdate: 30,
  // 追加候補の出現回数を集計する、直近の文生成の件数
  additionWindow: 30,
  // 削除判定に必要な、手札語彙に入ってからの文生成回数
  removalMinGenerationsSinceAdded: 90,
  // 削除判定の直近の集計期間（文生成の件数）
  removalRecentWindow: 60,
  // 削除判定の使用回数のしきい値（直近の集計期間で、この回数以下なら削除候補）
  removalMaxRecentUses: 0,
  // 1回の語彙更新で足す語数・外す語数の上限
  maxAdditions: 5,
  maxRemovals: 5,
  // 語彙更新検証に使う履歴：直近の何件から何件、それより前から何件
  validationRecentWindow: 30,
  validationRecentCount: 20,
  validationOlderCount: 10,
  // 語彙更新検証の合格の基準（仮）
  // 増やす・減らす：悪化が比較した件数のこの割合以下なら合格
  validationMaxWorsenedRatio: 0.25,
  // 変えない：改善が悪化よりこの件数以上多ければ合格
  validationMinImprovedMargin: 2,
  // 1回の語彙更新の費用の上限（円）と、円に直すときの為替（円/ドル）
  maxCostYen: 40,
  yenPerUsd: 150,
} as const;

export type VocabOpsSettings = typeof vocabOpsSettings;

// 語彙更新で使う AI のモデル（追加候補の順位付け、語彙更新検証の比較判定）
export const vocabOpsModel = "deepseek/deepseek-v4.1-flash";

// 語彙更新のプロンプトを変えたら、この版を進める
export const vocabOpsPromptVersion = "2026-10-18.1";
