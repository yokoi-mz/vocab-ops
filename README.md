# vocab-ops

外国語で話すときに実際に使う語の集まり（手札語彙）を決め、その語だけで言いたいことを外国語の文にするアプリ。文生成の履歴から、よく必要になる語を足し、使われない語を外す「語彙更新」を自動で行う。

自分の Mac の上だけで動かす個人用のアプリで、インターネットには公開しない（127.0.0.1 で待ち受ける）。

## できること

- **文生成**：言いたいことを日本語で入れると、2つの文が返ってくる。
  - 手札語彙文：手札語彙とノーカン語彙だけで作った文
  - 拡張語彙文：手札外語彙の語を数個まで使ってよい文
- **履歴**：文生成の画面の下に、これまでの文生成が並ぶ。1回分ずつ削除できる。
- **語彙**：言語ごとに、手札語彙とノーカン語彙の一覧を見る。増減モードを選ぶ。最近の語彙更新（足した語・外した語）を見る。
- **語彙更新**：文生成が 30 回たまるごとに、裏で自動で行う。

## 必要なもの

- Node.js 26 以上
- OpenRouter の API キー

## 準備

```bash
npm install
```

OpenRouter の API キーを、環境変数 `OPENROUTER_API_KEY` として用意する。リポジトリの直下に `.env.local` を作り、次の1行を書く（`.env.local` は git に入らない）。

```
OPENROUTER_API_KEY=sk-or-...
```

言語ごとに、ベースライン（最初の手札語彙とノーカン語彙）を取り込む。ベースラインは `docs/baseline/<言語コード>-baseline.md` にある。

```bash
npm run import-baseline -- en
npm run import-baseline -- it
npm run import-baseline -- fr
```

DB（`data/vocab.db`）は、最初に使ったときに自動で作られる。

## 起動

ターミナルを2つ使い、次の2つを起動する。

```bash
npm run dev      # 画面（http://127.0.0.1:3000）
npm run worker   # 文生成と語彙更新を、裏で処理する
```

## コマンド

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発用のサーバー（画面と API） |
| `npm run worker` | ワーカー（待ちの文生成と語彙更新を処理する） |
| `npm run import-baseline -- <言語コード>` | ベースラインを DB に取り込む。手札語彙は最初の1回だけ、ノーカン語彙は何度でも取り込み直せる |
| `npm test` | 単体テスト |
| `npm run lint` | ESLint |

## 文書

設計は `docs/` にある。

| 文書 | 内容 |
|---|---|
| `docs/00-overview.md` | 背景、目的、用語集 |
| `docs/01-architecture.md` | 部品の分け方、処理の流れ、道具の決定 |
| `docs/02-data-model.md` | DB の表 |
| `docs/vocab-ops/` | 語彙更新の設計と、調整できる数値（`parameters.md`） |
| `docs/legacy-handover.md` | 旧版から引き継いだ知識（言語の規則、プロンプトなど） |
| `docs/baseline/` | 言語ごとのベースライン |
