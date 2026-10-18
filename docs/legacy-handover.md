# 旧版からの引き継ぎリスト

旧版（`語彙管理システム/`、最終コミット 91d6e54）から、新版に持っていく**知識**をまとめたもの。
旧版の**構造**（フォルダ構成・ファイルの分け方）は引き継がない。

- 旧コードを読まなくても新版を作れるように書いている。
- 「出典」は、確かめたくなったときに見る旧版のファイル。
- 各項目の扱い：**引き継ぐ**／**変える**／**やめる**／**未決**（定義書で決める）。

作成日：2026-10-17　更新：2026-10-18（新版の決定を9章に反映。用語を `00-overview.md` の用語集に合わせた）

用語の対応：旧版の「手札」「Active」＝新版の**手札語彙**、旧版の「Basic」＝新版の**ノーカン語彙**、旧版の「Level 1〜3」にあたるものは新版では**手札語彙文**（手札外語彙の語を使わない）と**拡張語彙文**（手札外語彙の語を数個まで）の2つ。旧版の画面の表示名・コード・プロンプトの中の英語（Basic、Active、BASIC LEMMAS、Level など）は、旧版の事実としてそのまま残している。

新版の用語は `00-overview.md` の用語集が正。

---

## 1. 旧版は何をするアプリか

外国語で話すとき、実際に口から出せるのは、知っている単語のうちの一部だけ。
旧版は、その「使うと決めた単語」（手札語彙）を管理し、**手札語彙の単語だけで、言いたいことをどう言えるか**を AI に試させるツール。

- 対応言語：フランス語・イタリア語・スペイン語・ドイツ語
- 画面は2つ：Vocabulary（手札語彙の管理。新版では「語彙一覧の画面」）と Simulator（言えるか試す）
- 利用者は本人だけ。手元の Mac で `npm run dev` して使う。

---

## 2. できること（機能一覧）

### Vocabulary 画面（新版では「語彙一覧の画面」）

| 機能 | 旧版の動き | 新版での扱い |
|---|---|---|
| 言語の切り替え | 上のタブで4言語を切り替え | 引き継ぐ |
| 一覧表示 | 辞書形のアルファベット順（大文字小文字を区別しない） | 引き継ぐ |
| 手札語彙の ON/OFF | スイッチ。押すと先に画面を変え、保存に失敗したら元に戻す | **やめる**（手札語彙は語彙更新でだけ変わる） |
| 単語の追加 | 言語・辞書形・意味・品詞・ON/OFF を入れて追加。言語・品詞・ON/OFF は連続入力用に保持 | **やめる**（同上） |
| 単語の削除 | 確認ダイアログのあと削除 | **やめる**（手札語彙は語彙更新でだけ変わる） |
| 検索 | 辞書形と意味の部分一致。`/` キーで検索欄へ | 引き継ぐ |
| 品詞フィルタ | 8品詞＋All。件数つき | 引き継ぐ |
| Active only | 手札語彙だけ表示 | 引き継ぐ |
| 件数とゲージ | 「230 / 247 active」 | **変える**：手札語彙の数を表示する（上限は設けない） |
| 読み上げ | 単語をクリックで発音 | 引き継ぐ |
| ノーカン語彙の一覧 | 画面なし（コードの中にだけある） | **変える**：一覧で見られるようにする（この画面では編集しない） |

### Simulator 画面

| 機能 | 旧版の動き | 新版での扱い |
|---|---|---|
| 入力 | 言語（国旗）・状況（任意）・言いたいこと（日本語、必須）・女性形／男性形 | 引き継ぐ |
| 送信 | Simulate ボタンか ⌘+Enter。3 Level が全部そろうまで待つ（約16〜60秒） | **変える**：ジョブにして待たない |
| Level | 3通り（新語 0／5まで／10まで） | **変える**：Level という分け方をやめ、毎回2つの文を作る。手札語彙文（手札外語彙の語を使わない）と、拡張語彙文（手札外語彙の語を数個まで使ってよい。上限は設定で変えられる） |
| 結果カード | Expression（文）・Translation（実際に伝わる意味）・Vocabulary（単語の内訳）・Comment | 引き継ぐ |
| 新語の赤字 | 手札語彙に無い語を赤字＋下線 | 引き継ぐ |
| ＋ボタン | 新語をその場で手札語彙に追加（OFFで登録済みならONにする） | **やめる**（手札語彙は語彙更新でだけ変わる） |
| 読み上げ | 文全体、単語ごと | 引き継ぐ |
| 費用表示 | 「$0.0025（約¥0.4）」。為替は 150円/ドル固定 | 引き継ぐ |
| 前回の結果の復元 | ブラウザの localStorage に1件だけ保存 | **変える**：履歴として DB に全件保存 |
| 入力の下書き | 書きかけの状況・言いたいことを localStorage に保存 | **やめる**：送信前の文章は保存しない |

---

## 3. データ

### 3.1 単語の表（旧版の形）

出典：`lib/db.ts`

| 列 | 型 | 意味 |
|---|---|---|
| id | 整数（自動採番） | |
| language | 文字 | French / Italian / Spanish / German |
| lemma | 文字 | 辞書形 |
| meaning | 文字 | 日本語の意味 |
| part_of_speech | 文字 | noun / verb / adjective / adverb / pronoun / preposition / conjunction / other |
| active | 0 / 1 | 1 なら手札語彙 |
| created_at | 日時 | |

- 重複防止：「言語・辞書形・品詞」の組で1つだけ。**大文字小文字は区別される**（`Haus` と `haus` が両方入る。新版で直す）。

### 3.2 今の中身（2026-10-17、`data/vocab.db`）

| 言語 | 登録 | 手札語彙（Active） | ノーカン語彙の数 |
|---|---|---|---|
| French | 247 | 230 | 71 |
| Italian | 253 | 253 | 60 |
| Spanish | 240 | 238 | 72 |
| German | 221 | 218 | 63 |

- どの言語も手札語彙が多かった（218〜253語）。新版の最初の手札語彙は、この手札語彙から**手作業で削って**作った（`docs/baseline/`）。
- **移すべきなのは `data/vocab.db` の実データ**。初期データ（seed）ではない。初期データの French は 241 語で、実データには自分で足した語が含まれている。
- 英語とスウェーデン語のデータは旧版に無い。叩き台を新しく作り、調整UI（9章）で選ぶ。

### 3.3 ノーカン語彙（旧版の Basic。文の骨組みの語）

出典：`lib/basicVocab.ts`

- 代名詞・冠詞・前置詞・接続詞・疑問詞・否定・be/have 相当・基本的な助動詞だけ。内容語は入れない。
- DB ではなくコードに直接書かれていた。いつでも使える語で、手札語彙の数には数えない。
- 活用形や縮約形（vais / du / nel / im）は書かない。辞書形だけ。
- 扱い：中身は**引き継ぐ**。英語とスウェーデン語の分は新しく作る。
- 新版では、普通の画面では**見るだけ**。ノーカン語彙を選ぶのは、管理用の調整UI（9章）で行う。調整UIで編集する以上、コードに直接書くのではなく、DB かデータファイルに置く必要がある（保存場所は未決）。

### 3.4 初期データの出どころ

出典：`lib/defaultVocab.ts`（自動生成）、`lib/seedVocab.ts`、`scripts/import-min2max.mts`

- 別プロジェクト `min2maxLanguages/review.html` の単語カードを取り込んだもの。196 の「概念」（get, remember, … など英語の見出し）を、各言語の語に対応させている。
- 台帳に無い概念は、手書きの仮訳（`PROVISIONAL`）で補っている。
- 扱い：新版では実データを移すので、取り込みスクリプトは**やめる**。概念ID（言語をまたいで同じ意味を対応させる番号）も今のところ持たない（決定）。

---

## 4. 言語の規則（採点の中身）

新版でいちばん大事な知識。DB もネットも使わない関数なので、**テストつきで移植する**。

### 4.1 辞書形の正規化

出典：`lib/lemma.ts` の `normLemma`

比べる前に、辞書形を次の順でそろえる。

1. Unicode を NFC にそろえる
2. 小文字にする
3. `’` `` ` `` `´` を `'` にそろえる
4. 記号 `¡ ! ¿ ? . , ; : " « » “ ” ( )` を消す
5. 末尾のハイフンを消す（`Lieblings-` → `lieblings`）
6. 連続する空白を1つにし、前後の空白を消す

### 4.2 表記ゆれの吸収

出典：`lib/lemma.ts` の `variants`

1つの辞書形から、次の候補も作って照合する。

| 規則 | 例 |
|---|---|
| 先頭の `se ` `s'` `sich ` を外す | `se souvenir` → `souvenir`、`sich erinnern` → `erinnern` |
| スペイン語：`-arse/-erse/-irse` → `-ar/-er/-ir` | `quedarse` → `quedar` |
| イタリア語：`-arsi/-ersi/-irsi` → `-are/-ere/-ire` | `preoccuparsi` → `preoccupare` |

複数語の見出し（`avoir besoin de`、`tut mir leid`）は、見出し全体に加えて**構成する各語も使ってよい**扱い（`avoir`、`besoin`、`de` が手札語彙扱いになる）。

### 4.3 1語の判定（Basic / Active / New / Free）

旧版の判定ラベル。Basic＝ノーカン語彙、Active＝手札語彙、New＝手札外語彙の語、Free＝数えない固有名詞・数字。新版でのラベル名は未決。

出典：`lib/lemma.ts` の `classify`

上から順に判定する。

1. 固有名詞（AI が `kind: "proper_noun"` と申告）→ **Free**
2. 数字として書かれたもの（`kind: "number"` かつ表層形が数字と記号だけ：`6`、`2024`）→ **Free**。`six` や `sei` のように文字で書いた数は普通の語。
3. 辞書形（とその表記ゆれ）がノーカン語彙にある → **Basic**
4. 手札語彙（Active）にある → **Active**
5. それ以外 → **New**（DB にあるが OFF の語は「DBでOFF」と表示を区別）

New の数は、**辞書形の種類数**で数える（同じ語が2回出ても1つ）。

### 4.4 AI の答えの採点（3つのチェック）

出典：`lib/simulator.ts` の `judge`

1つでも引っかかれば不合格。理由を英語で AI に返して作り直させる（**最大3回**）。

| チェック | 中身 |
|---|---|
| A. 新語の上限 | New の種類数が、その Level の上限以下か |
| B. 書き出し漏れ | 文に出てくる単語が、すべて単語一覧（tokens）に載っているか。載っていない語は New の申告漏れかもしれない |
| C. 辞書形の取り違え | Basic か Active と判定された語のうち、「表層形4文字以上・辞書形4文字以下・頭文字が違う・表層形が辞書形を含まない」ものを疑う |

細かい規則：

- B では、縮約（`j'` `qu'` `l'` `un'`）を AI が元の形（`je` `que` `le` `una`）で書くことがあるので、母音で終わる語は末尾の母音を落とした形でも一致とみなす。
- C の例外：辞書形が `être` `ser` `ir` `sein`（形がまったく変わる動詞）、辞書形に空白を含むもの、イタリア語の `nel` `nella` → `in`。
- AI 側の失敗（時間切れ・起動できない）は作り直さず、その Level だけエラーにする。JSON が読めないときは作り直す。

### 4.5 テストケースにする例（旧版で確認済み）

| 入力 | 期待 | 旧版の結果 |
|---|---|---|
| `J'ai vécu six mois en Italie.` を単語に分ける | `j, ai, vécu, six, mois, en, italie` | ○ |
| `Italie`（proper_noun） | Free | ○ |
| `6`（number） | Free | ○ |
| `six`（number と申告） | New | ○ |
| `J'` → `je` | Basic | ○ |
| C：`suis` → `être` | 疑わない | ○ |
| C：`Ding` → `kein` | 疑う（本当に間違い） | ○ |
| C：`mieux` → `bien` | 疑わない | **×（誤判定）** |
| C：`besser` → `gut` | 疑わない | **×（誤判定）** |
| C：`meglio` → `bene` | 疑わない | **×（誤判定）** |
| C：`Ihnen` → `Sie` | 疑わない | **×（誤判定）** |
| C：`euch` → `ihr` | 疑わない | **×（誤判定）** |

×の5件は、比較級→原級、代名詞の格変化→主格という、辞書形として通用する対応。新版では誤判定しないように直す（例外の一覧を持つ、または C は警告だけにする）。**未決**。

英語とスウェーデン語の例を旧版の規則に通した結果（2026-10-17）：

| 入力 | 期待 | 旧版の結果 |
|---|---|---|
| C：`went` → `go`、`were` → `be` | 疑わない | **×（誤判定）** |
| C：`better` → `good`、`best` → `good`、`worse` → `bad` | 疑わない | **×（誤判定）** |
| C：`bought` → `buy` | 疑わない | ○ |
| C：`gick` → `gå`、`bättre` → `bra`、`honom` → `han`、`varit` → `vara` | 疑わない | ○ |
| `I don't think we're late.` を単語に分ける | 短縮形の扱いを決めてから | `i, don, t, think, we, re, late`（`'` で切れる） |

- 英語は日常語に不規則な形が多いので、チェック C をそのまま使うと作り直しが頻発する。
- 英語の短縮形は、AI が `do` + `n't` と書き出すと `don` が一覧に無いとされ、チェック B で不合格になりうる。プロンプトの単語のルールに英語の項目を足し、単語の切り方もそれに合わせる必要がある。

### 4.6 言語を足すときに必要なもの

旧版の規則は、4言語で困った例から少しずつ足されてきたもの。新版では将来も言語を増やす前提なので、言語ごとの違いを**言語ごとの設定として1か所に**まとめ、言語ごとのテストケースと一緒に置く。

| 言語ごとに要るもの | 旧版での置き場 |
|---|---|
| 言語コード（HTML の lang、読み上げ） | `lib/config.ts` |
| ノーカン語彙 | `lib/basicVocab.ts` |
| 文法の注意（プロンプトに差し込む文） | `lib/simulator.ts` の `GRAMMAR_CHECKS` |
| 単語の書き出しの特別ルール（縮約、分離動詞、再帰動詞、英語の短縮形など） | プロンプトの TOKENS 節に全言語まとめて |
| 表記ゆれの吸収（`se `、`sich `、`-arse` など） | `lib/lemma.ts` の `variants` |
| 取り違え検出の例外（`être` `ser` `ir` `sein`、`nel`→`in` など） | `lib/simulator.ts` の `judge` |
| 読み上げの地域（fr-FR など） | `lib/speech.ts` の `REGION` |
| 国旗 | `app/Flag.tsx` |
| テストケース | なし |

---

## 5. プロンプト

出典：`lib/simulator.ts`

**引き継ぐ**。ただし新版では手札語彙文（手札外語彙の語を使わない）と拡張語彙文（手札外語彙の語を数個まで）の2つにするので、それぞれの目標の文は**書き直す**。

### 5.1 システムプロンプト（全文）

```
You are a speaking-simulation engine for a language learner.
The learner may only use a limited set of lemmas. Your job is to express what they want to say
in the target language while respecting a strict budget of NEW lemmas (lemmas not in their lists).
Output ONLY one JSON object. No prose, no markdown, no code fences.
```

### 5.2 本文プロンプト（全文。`${…}` は差し込み）

```
TARGET LANGUAGE: ${language}

SPEAKER: ${SPEAKER_RULE[speaker]}

SITUATION (may be empty): ${situation || "(none)"}

WHAT THE LEARNER WANTS TO SAY (usually Japanese):
${message}

${LEVEL_GOALS[level]}

== GRAMMAR ==
The expression must be grammatically correct ${language}. Unnatural or simple is OK at low levels; wrong grammar is not.
The vocabulary limit restricts WHICH lemmas you use, never HOW you inflect them: if the correct form needs an allowed lemma
(e.g. an auxiliary, an article, an agreement ending), you must use the correct form.
Check especially: ${GRAMMAR_CHECKS[language] ?? "auxiliaries, agreement, prepositions, word order."}
Workflow:
1. write "draft".
2. "vocab_check": list every content lemma of the draft that is NOT in the BASIC/ACTIVE lists (these are NEW). If there are more than the budget allows, rewrite the draft with allowed lemmas / paraphrase until it fits.
3. "grammar_check": list each grammar error you find and its fix.
4. write the corrected final "expression".

== VOCABULARY RULES ==
- Allowed without cost = BASIC lemmas ∪ ACTIVE lemmas (lists below).
- Any inflected/conjugated/agreed form of an allowed lemma is free (e.g. lemma "aller" allows "vais", "allé", "irai").
  Any grammar is allowed (subjunctive, conditional, past tenses...). Only lemmas are restricted.
- Any lemma not in the lists is NEW. Count = number of DISTINCT new lemmas (not surface forms).
- NEW lemma budget for this level: ${maxNew}. Do not exceed it.
- Proper nouns (names of people, places, countries, brands) are free: mark them kind "proper_noun".
- Numbers written with digits (6, 2024) are free: kind "number". Numbers written as words are normal words.

== TOKENS ==
- List EVERY word of "expression" in order of appearance, including articles, pronouns and prepositions.
- "surface" = exactly as it appears in expression. "lemma" = dictionary form in ${language}.
  "meaning" = short Japanese gloss of the LEMMA (dictionary meaning, e.g. "住む" not "住んでいた").
  "kind" = "word" | "proper_noun" | "number".
  "pos" = part of speech of the lemma: noun | verb | adjective | adverb | pronoun | preposition | conjunction | other.
- Elided forms: "J'" → lemma "je", "l'" → "le", "d'" → "de", "qu'" → "que".
- Contractions (du, au, des, nel, della, im, zum, del, al ...): one token, lemma = the preposition (de, à, in, di, zu, a ...).
- A multi-word entry from the lists (e.g. "parce que", "s'il te plaît", "avoir besoin de") may be one token
  whose lemma is exactly the listed entry.
- German separable verbs: give the separated particle token the same lemma as the verb.
- Reflexive verbs: lemma without the reflexive pronoun is fine; the pronoun is its own token.

== OUTPUT JSON ==
{
  "draft": "first version of the ${language} text",
  "vocab_check": "NEW lemmas in the draft and how you removed/kept them within the budget",
  "grammar_check": "short English notes: auxiliaries, agreement, prepositions, articles, word order — each error found and how it was fixed (or 'no errors')",
  "expression": "the corrected ${language} text the learner would actually say",
  "tokens": [{ "surface": "...", "lemma": "...", "meaning": "...", "kind": "word", "pos": "verb" }],
  "full_translation": "natural Japanese translation of what the expression ACTUALLY conveys (so the learner can see what meaning survived), not the original request",
  "comment": "1-2 short Japanese sentences about MEANING only: what you worked around, what nuance was lost, or what the new lemmas made expressible. Do not talk about counts or rules."
}

== BASIC LEMMAS (${language}) ==
${basic.join(", ")}

== ACTIVE LEMMAS (${language}) — lemma: meaning ==
${active.map((a) => `${a.lemma}: ${a.meaning}`).join("\n")}
```

作り直しのときだけ、最後に次を足す。

```

== YOUR PREVIOUS ANSWER WAS REJECTED ==
${feedback}
Rewrite the answer so it satisfies every rule. Output the full JSON again.
```

`feedback` の中身：

- JSON が読めなかったとき：`Your output could not be parsed as the required JSON object. Output ONLY the JSON object.`
- 採点で不合格のとき：`Previous expression: ${前回の文}` の次の行から、該当する理由を並べる。
  - C：`These lemmas look wrong: "surface" → "lemma", .... Give the real dictionary form of each word. If that lemma is not in the lists, it is NEW.`
  - B：`These words of the expression are missing from "tokens": .... Every word must be listed.`
  - A：`You used N new lemmas (...), but the limit is M. Replace some of them with BASIC/ACTIVE lemmas or paraphrase.`

### 5.3 Level の目標（旧版の3通り。新版では手札語彙文と拡張語彙文の2つに書き直す）

```
Level 1: use ZERO new lemmas. Only BASIC and ACTIVE lemmas.
Priority: get the original meaning across somehow, even if unnatural.
If something cannot be said directly: split into several short sentences, simplify, paraphrase descriptively,
take a detour, or give up minor nuances.
```

```
Level 2: you may use at most 5 new lemmas (0 is fine if not needed).
Priority over Level 1: keep more of the original meaning, be a bit more natural, less roundabout.
Choose new lemmas that are versatile and high-frequency (useful in many future situations),
not rare or unnecessarily advanced words.
```

```
Level 3: you may use at most 10 new lemmas (use fewer if enough).
Priority over Level 2: keep the original meaning more precisely, sound natural, keep needed nuances.
Still prefer versatile, high-frequency new lemmas. This is NOT unrestricted translation.
```

### 5.4 話し手の性別（全文）

- female：`The speaker is a WOMAN. Use feminine forms whenever she refers to herself (je suis restée, je suis fatiguée, sono andata, estoy cansada). The listener and third parties keep their own gender (default masculine).`
- male：`The speaker is a MAN. Use masculine forms whenever he refers to himself (je suis resté, je suis fatigué, sono andato, estoy cansado).`

### 5.5 言語ごとの文法の注意（全文）

- French：`passé composé auxiliary: être for movement/state verbs (aller, venir, rester, partir, arriver, sortir, entrer, naître, mourir, tomber, retourner) and all pronominal verbs → je suis resté, je suis allé, je me suis souvenu; avoir otherwise. Past participle agreement with être. Country prepositions: en Italie / au Japon / aux États-Unis. Negation ne ... pas. Elision (j', l', qu').`
- Italian：`passato prossimo auxiliary: essere for movement/state verbs (andare, venire, stare, essere, restare, tornare, partire, uscire) and reflexive verbs, with participle agreement → sono andato/a; avere otherwise. Article + possessive (il mio amico). Articulated prepositions (nel, alla, dal). piacere construction (mi piace).`
- Spanish：`ser vs estar. gustar / encantar construction (me gusta). Preterite vs imperfect used appropriately. Personal a before people. Adjective agreement.`
- German：`Verb-second word order in main clauses, verb-final in subordinate clauses (weil, dass, wenn). Perfekt auxiliary: sein for movement/state change (gehen, fahren, kommen, bleiben), haben otherwise. Separable verbs. Cases after prepositions and articles. Noun capitalization.`

### 5.6 プロンプトについて分かっていること

- `draft` `vocab_check` `grammar_check` は、AI に自己点検させるための欄。**アプリは読まずに捨てる**。書かせること自体が目的。
- 長さは French で約 7,300 字（骨組み約 3,900＋ノーカン語彙 約 390＋手札語彙 230 行で約 3,000）。
- **並び順が損をしている**：言いたいことと Level の目標が前のほう、ノーカン語彙と手札語彙の一覧が後ろにある。毎回変わらない部分を先に置けば、AI サービス側のキャッシュが効いて速く安くなる可能性がある。新版で**変える**候補。
- Comment は「数やルールの話をしない」と頼んでいるのに、新語の数に触れることがあった（実行例では「新語4つ」と書いたが実際は5つ）。Comment と Translation はアプリでは検証していない。

---

## 6. AI の呼び出し

出典：`lib/llm.ts`、`lib/models.ts`

| 項目 | 旧版 | 新版での扱い |
|---|---|---|
| 呼び方 | `pi` CLI を子プロセスとして起動。シェルを通さず、プロンプトは引数で渡す | **変える**：OpenRouter の HTTP API を直接呼ぶ（決定）。pi はアプリの部品としては使わない |
| モデル | DeepSeek V4.1 Flash（OpenRouter 経由） | 引き継ぐ候補 |
| 推論 | 切っている（`--thinking off`）。DeepSeek では推論が時間の大半を占めるため | 引き継ぐ |
| 制限時間 | 1回 120 秒 | 見直す（ジョブにするので、画面を待たせる制約はなくなる） |
| 並列 | 3 Level を同時に呼ぶ | 引き継ぐ（新版では、手札語彙文と拡張語彙文の2つを同時に作る） |
| 予備 | pi が使えないときだけ `claude -p` に切り替え | やめる候補 |
| JSON の取り出し | コードの囲みや前置きを消し、最初の `{` から最後の `}` までを読む | 構造化出力（JSON Schema 指定）に**変える**候補 |
| 実測（2026-10-17） | 1回 16.1 秒、$0.0025（約¥0.4）、3 Level とも1回で合格 | 新版の比較基準 |

---

## 7. 画面の細かい知見

| 項目 | 内容 | 出典 |
|---|---|---|
| 新語の色付け | 文を先頭から順に探し、単語一覧の表層形を見つけた位置で区切る。ある語の位置より手前に後ろの語が見つかったら、その語は表層形が崩れているとみなして飛ばす | `lib/segments.ts` |
| 内訳の表 | 同じ辞書形・同じ判定の語は1行にまとめ、表層形を並べる | `lib/segments.ts` |
| 読み上げの声 | 標準の地域（fr-FR など）を優先。Premium/Enhanced/Natural → Google → 端末内蔵 → その他の順。macOS の遊び用の声（Grandma など）は除外。速さ 0.95 | `lib/speech.ts` |
| 国旗 | 絵文字は OS で見た目が違うので自前の SVG | `app/Flag.tsx` |
| デザイン | 暗い背景、丸みのあるフォント（Quicksand、M PLUS Rounded 1c） | `app/globals.css` |

---

## 8. 既知の問題（新版で繰り返さない）

| 問題 | 確認 | 新版での対策の方向 |
|---|---|---|
| 開発モードで、選んだ言語と入力の下書きが再読み込みで消える。保存の処理が、復元より先に初期値で上書きしていた | 再現済み | 下書きは保存しない（決定）。選んだ言語などを保存するなら、保存は「復元が済んだ後」だけにする |
| 正しい辞書形を「取り違え」と誤判定する（4.5 の×の5件） | 関数を単体で実行して確認 | テストケースから始めて直す |
| 同じネットワークの誰でも API を使える（単語の削除、有料の AI 呼び出し） | 確認済み | 127.0.0.1 だけで待ち受け、自分の Mac からしかつながらないようにする（公開しないのでログインは作らない） |
| 壊れた JSON を送ると 500 が返る（単語の追加・ON/OFF） | 確認済み | 入口でスキーマ検証し、400 を返す |
| Comment と Translation の内容は検証されない | 実行例で確認 | 数の情報はアプリの値だけを表示する |
| 最悪6分待つ。止められない。送信直後に入力欄が消える | コードとスクショで確認 | ジョブ化、中断、送った内容を表示し続ける |
| 大文字小文字違いで同じ語を2回登録できる | コード上 | 正規化した辞書形で重複を防ぐ |
| API キーを `zsh -ic` で `.zshrc` から読む。読めなかった結果も覚えてしまう | コード上 | 環境変数（`.env.local`。git には入れない） |
| テストが1本もない | コード上 | 規則（4章）から単体テストを書く |

---

## 9. 新版で決まったこと

| 項目 | 決定 |
|---|---|
| 動かす場所 | ローカル環境。インターネットに公開しない。127.0.0.1 で待ち受け、ログインは作らない |
| DB | SQLite（ファイル1つ）。手札語彙・ノーカン語彙・文生成の履歴・ジョブをここに置く |
| AI の呼び方 | OpenRouter の HTTP API を直接呼ぶ。pi はアプリの部品としては使わない |
| 文生成で作る文 | 毎回2つの文を作る。手札語彙文は、手札語彙とノーカン語彙だけで作る（手札外語彙の語は使わない）。拡張語彙文は、手札語彙とノーカン語彙に加えて、手札外語彙の語を数個まで使ってよい。手札外語彙の語の数の上限は設定で変えられるようにし、最初は仮に5とする |
| ベースライン | 各言語で、それぞれ自由に選ぶ最初の手札語彙。150語は目安で、言語ごとに数が違ってよい。言語どうしの対応は持たない（ただし英語で決めたことを土台に、他の言語を作る）。置き場は `docs/baseline/<言語コード>-baseline.md` |
| ベースラインの進み具合 | 英語・イタリア語・フランス語を調整中（語数は各ファイルを見る。まだ変わる）。ドイツ語・スペイン語・スウェーデン語は後回し（ファイルだけ用意） |
| 言語コード | ISO 639-1 の小文字2文字を使う：en（英語）、fr（フランス語）、it（イタリア語）、es（スペイン語）、de（ドイツ語）、sv（スウェーデン語）。ファイル名・コード・DB で共通 |
| 概念ID | 持たない（今のところ） |
| 最初の手札語彙 | 旧版の `data/vocab.db` の手札語彙から、手作業で削って作った（`docs/baseline/`） |
| 対応言語 | フランス語・イタリア語・スペイン語・ドイツ語・英語・スウェーデン語。将来も増やす前提で、言語ごとの違い（4.6）を言語ごとの設定として1か所にまとめる枠組みにする |
| 手札語彙が変わる経路 | 最初は、調整UIで作ったベースラインを取り込むことで手札語彙ができる。そのあと手札語彙が変わるのは、語彙更新のときだけ。旧版にあった、語彙一覧の画面での追加・ON/OFF・削除と、Simulator の＋ボタンはやめる |
| 読み上げの声 | 言語ごとに、使う声を設定で選べる。選ばなければ旧版と同じ自動選択 |
| 英語の国旗 | イギリス |
| 語彙一覧の画面（旧版の Vocabulary 画面） | 閲覧専用。手札語彙とノーカン語彙の一覧を見る（検索・品詞フィルタ・読み上げは残す） |
| ノーカン語彙 | 通常の画面では一覧で見るだけで、編集はしない。ノーカン語彙を選ぶのは調整UIで行う。ノーカン語彙は手札語彙の数には数えない |
| ノーカン語彙に入れる語の共通ルール | 数の制限なし。代名詞・冠詞・疑問詞・接続詞・前置詞・be/have にあたる動詞・助動詞・否定に加え、**yes / no にあたる語（はい・いいえ）も全言語でノーカン語彙**にする |
| 調整UI（管理用、`vocabAdminSetup`） | 叩き台から、ベースラインとノーカン語彙を選ぶための簡単なツール。使うのは、最初のベースラインを作るときと、ノーカン語彙を選ぶときだけで、取り込んだあとの手札語彙の修正には使わない。候補を品詞ごとにグループ分けして並べ、似た語どうしの関係（重複・役割かぶり）をメモで示す。これで似た意味の語（英語の `hear` と `listen` など）のどちらを残すかを判断する。行をクリックして残す／外すを切り替えると、品詞ごとの語数と目標までの残りがリアルタイムで出る。結果は `docs/baseline/<言語>-baseline.md` に Markdown で書き出す。ツールは`docs/baseline/vocab-admin-setup.html` をブラウザで開いて使う。git の対象外。最初の版（英語用）は 2026-10-17 に作成 |
| 結果の保存 | 文生成の結果は DB に全件保存する。送信前の入力途中の文章は保存しない |
| 構成 | モジュラーモノリス。機能ごとのフォルダ（`language` `vocabulary` `generation` `vocab-ops`）＋業務知識を持たない `shared/`。一人で作るので、道具での強制はせず、規則のファイルが DB や fetch を import しないことと、他の機能は `index.ts` から使うことだけを守る |
| 作り方 | 旧版の構造は引き継がない。このリポジトリに一から作る。各種類の最初の1つは自分で書く |
| 言葉とコードでの名前 | `00-overview.md` の用語集に従う。旧版の Simulator は「手札語彙での文生成」（略して文生成。関数は `generateWithVocab()`）と呼ぶ |


## 10. 未決の論点

定義書で決める。

1. ベースラインとノーカン語彙の取り込み方：調整UIの結果は `docs/baseline/` の Markdown に書き出す。アプリがそれをどう読み込んで DB に入れるか
2. ドイツ語・スペイン語・スウェーデン語のベースライン（後回し。英語・イタリア語・フランス語と同じく、決定済みの言語を土台に叩き台を作り、調整UIで絞る見込み）
3. 拡張語彙文の手札外語彙の語の数の上限（仮に5。設定で変えられる）

決まった論点：
- 手札語彙文・拡張語彙文の目標の文 → 2026-10-18 の実験で決めた（`vocab-ops/experiments/2026-10-18-prompt-tuning.md`）。手札語彙文は「聞き手が、元の文の言っていることを理解できること。主な動作と大事な場所・物・人・時を残し、言えないものはリストの語で数語の説明にする」を優先し（作らせる回数の上限は5回）、拡張語彙文は「意味が明確・正確になるなら手札外語彙の語を使う」
- 取り違え検出（チェック C）→ 全言語で、旧版と同じく不合格にして作り直させる。英語では、表層形が「辞書形＋語形変化ではない文字」の場合（`weekend` を `week` と書き出したなど）も疑う（2026-10-19 に追加）。誤判定は、言語ごとの例外一覧（`src/features/language/language-rules.ts`）で防ぐ。旧版で誤判定した5件と、英語の不規則な形（went→go、were→be、better・best→good、worse・worst→bad）を最初から入れる。新しい誤判定が見つかったら、例外一覧とテストに足す
- 履歴の見せ方 → 別の画面は作らず、文生成の画面の下に、選んでいる言語の履歴を新しい順に並べる（20件ずつ）。行を押すと、その場で手札語彙文・拡張語彙文のカードを開く。作り終わった文は、そのまま履歴の一番上に加わる
- 話し手の性別（女性形・男性形）→ 自分について言うときに語形が変わる言語（フランス語・イタリア語・スペイン語・ドイツ語）だけで選ばせる。英語とスウェーデン語では、画面に出さず、プロンプトにも書かない（言語ごとの規則 `hasSpeakerGender`）。DB の `generations.speaker` には、その場合も値（初期値の female）が入るが、意味は持たない
- 英語の短縮形 → 単語に分けるとき、英語だけは単語の中のアポストロフィで切らない（`don't` は1語）。AI が `do` と `n't` に分けて書き出した場合も、つなげた形で一致とみなす
- 新版での判定ラベルの名前 → 手札語彙（`activeVocab`）・ノーカン語彙（`uncountedVocab`）・手札外語彙（`outsideVocab`）・固有名詞・数字（`properOrNumber`）（`00-overview.md` の用語集）
- 調整UI のコードでの名前 → `vocabAdminSetup`（`00-overview.md` の用語集）
- 調整UIでの似た意味の語の見せ方 → 品詞ごとのグループ分け＋似た語どうしの関係のメモ（9章の表）
- 調整UIの置き場所 →手元のHTMLファイル（git管理なし）
- ノーカン語彙に入れる語の種類 → 代名詞・冠詞・疑問詞・接続詞・前置詞・be/have にあたる動詞・助動詞・否定・yes/no（9章の表。語数は各 `*-baseline.md` を見る）
- 英語の国旗と読み上げ → 9章の表
