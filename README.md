# jev-checkkit

TypeSafe の Jev を使って、自分で決めた対象を、承認済みのチェックリストで素早く検査するためのツールキットです。Jev は文章を生成しません。状態と、型の決まった小さな質問を受け取り、確率付きの判定を返します。このリポジトリには、チェックリストを設計するためのスキル `create-jev-cheker-skill` と、Jev の判定を組み合わせて結果をまとめるランナー（CLI `jev-check`）が入っています。

対象は利用者が決めます。PR の説明でも、引き継ぎメモでも、AI が生成した回答でも、名指しできるものなら何でも構いません。流れはいつも同じで、設計スキルがチェックリスト全体の案を出し、利用者が手を入れて全体を承認し、その定義で `jev-check` が Jev に問い合わせます。

全体の計画は [`docs/jev-checker-plan.md`](docs/jev-checker-plan.md) にあります。リポジトリは https://github.com/s-hiraoku/jev-checkkit です。

## 使い方

### 1. 設計スキルに対象を伝える

設計スキル `create-jev-cheker-skill`（[`skills/create-jev-cheker-skill/SKILL.md`](skills/create-jev-cheker-skill/SKILL.md)）を、スキルを読めるエージェント（Codex など）で呼び出し、次の 4 つを伝えます。

| 伝えるもの | 内容 |
| --- | --- |
| 対象 | 何を検査したいか。下の「候補にする対象」から選んでもよいし、それ以外の対象を名指ししてもよい |
| 資料 | 対象の実例と、いま人が行っている確認の手順 |
| 保存先 | 定義ファイル（JSON）を書き出すパス |
| 承認者 | チェックリストを承認する人。定義ファイルの `approval.by` に記録される |

スキルは資料を読み、確認したい条件を「コードで決められること」と「Jev に意味を聞くこと」に分けます。数値の範囲、構文、ファイルの有無のように機械的に決められることはコード側の仕事で、質問になるのは意味・整合性・抜けの判断だけです。

### 2. チェックリスト全体を確認して承認する

スキルは、対象に対する質問をすべて 1 つの定義ファイルの形（`approval.status` が `draft`）で下書きし、全項目・全フィールドをそのまま見せます。

- 項目を足す、削る、文言や閾値を変えるなど、直したいところがあれば伝えます。スキルは直したうえで、差分ではなくリスト全体をもう一度見せます。
- 全体にまとめて承認を出すと、スキルは `approval` を `approved`（承認日時と承認者つき）にして保存先に定義ファイルを書き、`jev-check --dry-run` でパーサーが受け付けることを確認します。
- 承認前の定義で検査を走らせることはありません。承認後に内容を変えたときは `version` を上げ、全体をもう一度承認してもらいます。

スキルの出力は、ふつう定義ファイル 1 つだけです。対象の集め方（どのファイルを読んで `state` をどう組むか）をエージェントに教える必要があるときに限り、その手順と `jev-check` の実行コマンドだけを書いた実行用スキルを追加で出します。

### 3. jev-check で検査する

承認済みの定義ファイルと、検査する対象を `state` に入れた入力ファイルを `jev-check` に渡します。用途に応じて 3 つの動かし方があります。

```bash
# dry-run: Jev に送る予定の state と questions を表示して止まる。キーは不要
npx jev-check --dry-run --definition <定義ファイル> --input <入力ファイル>

# replay: 保存しておいた Jev の応答を使って判定の流れを試す。ネットワークには出ない
npx jev-check --replay <replay ファイル>

# live: 実際に Jev に問い合わせる。TYPESAFE_API_KEY を環境変数に設定してから実行する
npx jev-check --definition <定義ファイル> --input <入力ファイル>
```

`jev-check` は定義ファイルを解析して承認済みかどうかを確認し、対象に当たる質問を 1 回の呼び出しにまとめて Jev に送り、質問ごとに pass / fail / review / not_applicable / error の判定を付けた JSON レポートを出します。レポートはあくまで判断材料です。結果をもとに公開・マージ・削除・外部送信を自動で行うことはしません。具体的な手順は下の「[用例: AI の回答にハルシネーションがないか調べる](#用例-ai-の回答にハルシネーションがないか調べる)」を参照してください。

## 候補にする対象

対象は利用者が名指ししたものなら何でも構いません。ここから選ぶ必要はなく、ここにないからといって対象外になるわけでもありません。次の 5 件は、この仕組みに向いていると考えて候補として挙げているものです。どれも設計スキルが案を出し、利用者が承認してから定義ファイルになります。製品として承認済みのチェックリストはまだありません。

### 1. PR の説明と差分

単位はプルリクエスト 1 件。集めるのは説明文、タイトル、ファイル差分です。

コードで見るのは、変更ファイルの数、テストファイルの有無、説明が空かどうか、テンプレートが埋められていないか、といった機械的な条件です。Jev に聞くのは、説明が差分の意図とずれていないか、リスクや未完了の作業を伏せていないか、レビュアーが判断できる粒度で書かれているか、です。

PR は頻度が高く、既存のレビュー手順と比べてどれだけ価値が増えたかを測りやすい対象です。誤判定があってもレビューの議論が少しずれる程度で済み、マージするかどうかは人が決めます。

### 2. 開発ログ・引き継ぎメモ

単位はログ 1 件、または引き継ぎメモ 1 件。集めるのは本文と、あれば関連するコミットやチケットへの参照です。

コードで見るのは日時の欠け、空の見出し、参照リンクの形式です。Jev に聞くのは、決めたこと・試したこと・未解決のことが書き分けられているか、次の人がそこから再開できるか、根拠のない「完了」が書かれていないか、です。

同じ形式の文書を検査できれば、計画と運用のずれを防げます。誤判定の影響は次の担当者の手戻りにとどまり、削除や外部送信は行いません。

### 3. Skill の文面と実装

単位は Skill のディレクトリ 1 つ。集めるのは `SKILL.md` と、同じディレクトリにあるスクリプトや参照ファイルです。

コードで見るのは、宣言されたパスが実在するか、禁止しているファイル名が混ざっていないか、バリデータの終了コードです。Jev に聞くのは、手順の文言が実装と矛盾していないか、本文が自分で決めた禁止事項を破っていないか、省いた手順を「やった」と書いていないか、です。

このリポジトリの設計スキル自身も、あとから同じやり方で検査できます。誤判定の影響は、エージェントが古い手順を信じてしまうことです。

### 4. リリースノートと出荷差分

単位はリリース 1 つ。集めるのはリリースノートと、タグ間のコミットまたは差分です。

コードで見るのはバージョン文字列、日付、コミットの有無です。Jev に聞くのは、利用者向けの文章が出荷内容を大きく、あるいは小さく書いていないか、破壊的変更が本文から抜け落ちていないか、です。

読者は PR の説明より広いので、誤判定は出荷内容の誤解につながります。公開するかどうかは人が決めます。

### 5. 障害メモ・インシデントメモ

単位はメモ 1 件。集めるのは本文と、あれば関連するログやチケットの識別子です。

コードで見るのはチケット番号の形式、時刻、必須の見出しが空でないかです。Jev に聞くのは、影響範囲・再現手順・切り戻し・担当者が揃っているか、推測を事実のように書いていないか、です。

抜け漏れを早く見つけるための用途です。誤判定すると対応の優先度を間違えるおそれがあります。障害票のクローズや外部への連絡は人が決めます。

## 対象にしないもの

対象は上の 5 件に限りませんが、次の 5 つは対象外です。

- 一般的な文章の添削。Jev は校正ツールではありません。
- 構文、型、テスト、カバレッジ。コードで判定できることを Jev に聞きません。
- 「コードの品質」を 1 つの質問で点数化すること。狭い質問に分けて、コード側で合成します。
- レポートの結果をもとにマージ、削除、公開、外部送信を行うこと。閾値を超えても自動では実行しません。
- チケット分類やモデレーションのような汎用基盤。TypeSafe の用例にはありますが、このリポジトリの対象ではありません。

## 規則

- チェックリストは必ず全文を見せて承認をもらいます。内容を変えたら、変えた部分だけでなく全体をもう一度承認してもらいます。承認前の定義で検査を走らせることはしません。
- Jev に任せるのは意味の判断だけで、それも小さな質問に分けて聞きます。数値の範囲、構文、ファイルの有無のように機械的に決められることは、コード側で処理します。
- 同じ対象への質問は、できる限り 1 回の Jev 呼び出しにまとめます。
- 判定は pass / fail / review / not_applicable / error の 5 種類です。○か×かの二択には潰しません。
- 確率は「正しさの証明」ではありません。レポートの結果をもとに、公開・マージ・削除・外部送信を自動で行うことはしません。

## 構成

計画上は次の 4 つに分けています。

- 設計スキル `create-jev-cheker-skill`（`skills/create-jev-cheker-skill/`）。対象を調べ、チェックリスト案を出し、承認を受けてから定義ファイルを書きます。日常の検査ループには入りません。
- 対象ごとの checker 定義。承認済みの質問、安定した ID、適用条件、閾値、バージョンを持つ JSON データです。
- 共通の TypeScript ライブラリと CLI。入力の検証、Jev への一括送信、閾値の適用、欠落・失敗・対象外の扱い、使用量と時間の記録を担います。
- Hook やプラグイン。イベントから自動で走らせたいときだけの薄い接続で、最初のリリースには含めません。

## CLI と定義ファイルの詳細

### セットアップ

Node 20 以上が必要です。

```bash
npm ci
npm run build
npm test
npx jev-check --definition <file> --input <file>
npx jev-check --dry-run --definition <file> --input <file>
npx jev-check --replay fixtures/replay/pass.json
```

テストは 3 段あります。

- `npm test`: ユニットテスト（`tests/*.test.ts`）。キー不要。
- `npm run test:lanes`: 機能テスト（`tests/lanes/`）。ビルドしてから、[`docs/jev-checker-plan.md`](docs/jev-checker-plan.md) の live レーン 20 本（PR1 の CLI 10 本と PR2 のスキル 10 本）を `dist/cli.js` と `skills/` に対して実行します。`--dry-run` と `--replay` だけなので Jev は呼びません。キー不要。
- `npm run test:e2e`: E2E（`tests/e2e/`）。AI の回答のハルシネーション検査を、設計スキルの草案から承認、承認済み定義の書き出し、忠実な回答と作り話の回答の 2 入力、Jev の実呼び出し、人が読むレポートまで一気に通します。Jev を呼ぶ手順は `TYPESAFE_API_KEY` があるときだけ走り、無いときはスキップして失敗にはしません。承認者は `e2e-test` で、承認済み定義はテストの一時ファイルにだけ書きます。キーの値は出力しません。

`jev-check` はまず定義ファイルを解析して承認済みかどうかを確認し、`TYPESAFE_API_KEY` は Jev に送信する直前にだけ参照します。キーが無いときは live 呼び出しをせず、終了コード 3 で止まります。`--dry-run` と `--replay` はキー無しで動きます。キーの値はログにも出力にも出しません。

### 定義ファイル

`--definition` に渡す JSON です。`approval.status` が `approved` でない定義は解析の段階で拒否し、`{ "error": ... }` を出力して終了コード 2 で止まります。

```json
{
  "id": "sample-paragraph",
  "version": 1,
  "subject": "A short English paragraph",
  "approval": { "status": "approved", "at": "2026-09-19T00:00:00Z", "by": "fixture" },
  "questions": [
    { "id": "one_claim", "type": "noul", "instructions": "...", "criteria": { "true": "...", "false": "..." }, "passAt": 0.8, "failAt": 0.2 },
    { "id": "tone", "type": "choice", "instructions": "...", "criteria": { "neutral": "...", "hostile": "..." }, "options": { "neutral": "pass", "hostile": "fail" }, "confidenceFloor": 0.6 },
    { "id": "clarity", "type": "score", "instructions": "...", "criteria": ["...", "...", "..."], "passAt": 1.5, "failAt": 0.5, "confidenceFloor": 0.6 },
    { "id": "cites_source", "type": "noul", "instructions": "...", "applyWhen": { "path": "claimsSource", "op": "equals", "value": true } }
  ]
}
```

- `id` は定義の安定 ID、`version` は 0 以上の整数です。`questions` は 1 件以上で、質問の `id` は重複できません。
- `noul` は `passAt` 以上なら pass、`failAt` 以下なら fail、その間は review です。省略時は 0.8 と 0.2 になります。
- `choice` は `options` で各ラベルを pass / fail / review のどれかに対応づけます。表にないラベルは review になります。
- `score` は `passAt` と `failAt` を noul と同じ帯として使います。どちらも必須で、`criteria` は 2 件以上の配列です。
- `passAt` が `failAt` 以下になっている定義は拒否します。
- `choice` と `score` には任意で `confidenceFloor` を付けられます。`confidence` がこの値を下回ると、対応先が pass でも review になります。
- `applyWhen` は任意です。`{ "path": "a.b", "op": "exists" }` か `{ "path": "a.b", "op": "equals", "value": <JSON> }` の形で、`state` のドット区切りパスに対して評価します。条件を満たさない質問は Jev に送らず、not_applicable にします。
- `instructions` と `criteria` はそのまま Jev に送ります。`applyWhen`、閾値、`options` は送りません。

### 入力ファイル

`--input` に渡す JSON です。読むのは `state` だけで、他のキーは無視します。replay ファイルをそのまま渡しても構いません。

```json
{ "state": { "paragraph": "...", "claimsSource": true } }
```

### replay ファイル

`--replay` に渡す JSON です。`answers` が Jev の応答の代わりになるので、ネットワークには出ません。`definition` は replay ファイルからの相対パスで、`--definition` を付ければそちらが優先されます。`--input` を付ければ `state` もそちらのものを使います。`usage` は任意です。`answers` の形は SDK の応答と同じにしてください。

```json
{
  "definition": "../sample-approved.checker.json",
  "state": { "paragraph": "...", "claimsSource": true },
  "answers": {
    "one_claim": { "type": "noul", "noul": 0.93 },
    "tone": { "type": "choice", "choice": "neutral", "confidence": 0.9, "probabilities": { "neutral": 0.9, "promotional": 0.07, "hostile": 0.03 } },
    "clarity": { "type": "score", "score": 1.8, "confidence": 0.85, "legend": { "0": "...", "1": "...", "2": "..." }, "probabilities": { "0": 0.02, "1": 0.16, "2": 0.82 } }
  },
  "usage": { "input_tokens": 120, "output_tokens": 8 }
}
```

`fixtures/replay/` には、短い英文段落を対象にした pass、fail、review、not-applicable、missing-answer の 5 件と、次の節で使うハルシネーション検査の 2 件があります。いずれもサンプルで、製品用のチェックリストではありません。

### 用例: AI の回答にハルシネーションがないか調べる

AI が生成した回答を、その回答の根拠になった資料と突き合わせて「作り話をしていないか」を検査する例です。「使い方」の流れを一度通した結果がどんな定義ファイルになり、それをどう動かすかを示します。定義は [`fixtures/hallucination.checker.json`](fixtures/hallucination.checker.json)、replay の例は [`fixtures/replay/hallucination-pass.json`](fixtures/replay/hallucination-pass.json) と [`fixtures/replay/hallucination-fail.json`](fixtures/replay/hallucination-fail.json) にあります。承認前の草案として同じ質問を持つ [`fixtures/hallucination-draft.checker.json`](fixtures/hallucination-draft.checker.json) もあり、E2E テストが設計スキルの手順をたどる起点に使います。

`state` には、モデルに投げた質問、モデルが返した回答、モデルに渡した資料の 3 つを入れます。

```json
{
  "state": {
    "question": "モデルに投げた質問",
    "source": "モデルに渡した資料の本文",
    "answer": "モデルが返した回答"
  }
}
```

質問は 4 つで、どれも Jev には「意味」だけを聞きます。文字数や形式の検査はコード側の仕事なので、この定義には入れていません。

| id | 型 | 聞くこと | `source` が無いとき |
| --- | --- | --- | --- |
| `consistent_with_source` | noul | 回答が資料と矛盾していないか | not_applicable |
| `added_details` | choice | 資料に無い情報を足していないか。`none` は pass、`harmless` は review、数字・日付・出典・引用をでっち上げる `fabricated` は fail | not_applicable |
| `admits_uncertainty` | noul | 分からないことを推測で埋めず、分からないと書いているか | 検査する |
| `self_consistent` | noul | 回答の中で言っていることが食い違っていないか | 検査する |

```bash
# Jev に送る内容だけを確認する。キーは不要
npx jev-check --dry-run --definition fixtures/hallucination.checker.json --input fixtures/replay/hallucination-pass.json

# 保存済みの応答で判定の流れを試す。キーは不要
npx jev-check --replay fixtures/replay/hallucination-pass.json   # 終了コード 0
npx jev-check --replay fixtures/replay/hallucination-fail.json   # 終了コード 1

# 実際に Jev に問い合わせる。TYPESAFE_API_KEY を環境変数に設定してから実行する
npx jev-check --definition fixtures/hallucination.checker.json --input my-answer.json
```

`hallucination-fail.json` の回答は、開館時刻を資料と違う時刻にしたうえで、資料に無い改修年・費用・出典を足しています。replay では `consistent_with_source`、`added_details`、`admits_uncertainty` が fail、`self_consistent` だけが pass になり、終了コードは 1 です。

使うときの注意です。

- Jev が比べる相手は `state.source` として渡した資料だけで、世の中の事実と照合するわけではありません。資料そのものが間違っていれば、それに忠実な回答は pass します。pass は「資料と矛盾していない」という意味で、内容が真実であることの証明ではありません。
- `source` を渡さないと、資料と突き合わせる 2 問は not_applicable になり、残りの 2 問だけを検査します。検出できる範囲はかなり狭くなります。
- この定義はサンプルで、承認済みの製品チェックリストではありません。自分の用途で使うときは、設計スキル `create-jev-cheker-skill` で対象に合った質問を作り、全文を承認してから使ってください。
- fail が出ても、回答を自動で差し戻したり公開を止めたりはしません。結果をどう扱うかは人が決めます。

### レポート

標準出力に JSON を 1 件出します。

- `definition`: 定義の `id` と `version`
- `items`: 質問ごとの `id`、`verdict`、`reason`、Jev が答えていれば `answer`。定義と同じ順に並びます。
- `usage`: `input_tokens` と `output_tokens`。Jev を呼ばなかったときは 0 です。
- `timing`: `wallMs` と `jevMs`

マージ、削除、公開、送信を許可するフィールドはありません。`--dry-run` は Jev に送る予定の `state` と `questions` を出力して終了コード 0 で止まり、`answers` は含みません。

### 終了コード

| コード | 意味 |
| --- | --- |
| 0 | すべての項目が pass か not_applicable |
| 1 | fail が 1 件以上ある |
| 2 | fail は無いが、review か error が 1 件以上ある。または定義ファイルか入力ファイルを拒否した |
| 3 | `TYPESAFE_API_KEY` が無い、または Jev への送信に失敗した |

実装の順番と検証項目は [`docs/jev-checker-plan.md`](docs/jev-checker-plan.md) にあります。
