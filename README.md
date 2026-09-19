# jev-checkkit

TypeSafe の Jev を使い、対象ごとの承認済みチェックリストを高速に検査する。Jev は文章を書かない。状態と型付きの小さな質問を受け、確率付きの判定を返す。このリポジトリはその判定を合成するランナーと、チェックリストを設計するスキルを置く。

ランナーと CLI `jev-check` は入っている。設計スキルはまだない。計画は [`docs/jev-checker-plan.md`](docs/jev-checker-plan.md) にある。

リポジトリは https://github.com/s-hiraoku/jev-checkkit 。

## 規則

- チェックリストは全文を見せ、承認を待つ。改訂したら全体を取り直す。承認前にその定義で検査しない。
- 意味の判断は Jev の小さな質問に分ける。数値、構文、ファイルの有無など決められる条件はコードで扱う。
- 同じ対象への質問は、可能な限り1回の Jev 呼び出しにまとめる。
- 判定は pass / fail / review / not_applicable / error とする。○／× だけに潰さない。
- 確率は正しさの証明ではない。公開、マージ、削除、外部送信をレポートから自動で許可しない。

## 候補にする対象

下の5件は対象として残す。除外するのは次節だけである。製品チェックリストはまだ承認されていない。項目そのものは、設計スキルが案を出し、利用者が承認してから定義にする。どれを最初に定義するかは利用者が決める。

### 1. PR の説明と差分

単位はプルリクエスト1件。集めるものは説明文、タイトル、ファイル差分である。

コードが扱うのは変更ファイルの数、テストファイルの有無、空の説明、機械的なテンプレート未記入である。Jev が扱うのは、説明が差分の意図と食い違っていないか、リスクや未完了を黙っていないか、レビューアが判断できる粒度か、である。

頻度が高く、既存のレビュー手順と比べて増えた価値を測りやすい。誤判定の影響は、レビュー議論をずらすことまでである。マージは人が決める。

### 2. 開発ログまたは引継ぎ1件

単位はログ1件、または引継ぎメモ1件。集めるものは本文と、あれば関連するコミットやチケットへの参照である。

コードが扱うのは日時の欠損、空見出し、参照リンクの形式である。Jev が扱うのは、決定と試行と未解決が書き分けられているか、次の人が再開できるか、根拠のない完了宣言がないか、である。

同じ形の文書を検査できると、計画と運用が一致する。誤判定の影響は、次の人の手戻りである。削除や外部送信はしない。

### 3. Skill の文面と実装

単位は Skill ディレクトリ1つ。集めるものは `SKILL.md` と、そのディレクトリ内のスクリプトや参照ファイルである。

コードが扱うのは宣言されたパスの実在、禁止しているファイル名の混入、バリデータの終了コードである。Jev が扱うのは、手順の文言が実装と矛盾していないか、禁止事項を本文が自ら破っていないか、省略した手順を「やったこと」と書いていないか、である。

設計スキル自身を、あとから同じ対象として検査できる。誤判定の影響は、エージェントが古い手順を信じることである。

### 4. リリースノートと出荷差分

単位はリリース1つ。集めるものはリリースノートと、タグ間のコミットまたは差分である。

コードが扱うのはバージョン文字列、日付、コミットの有無である。Jev が扱うのは、利用者向けの文が出荷内容を過大または過少に書いていないか、破壊的変更が本文から消えていないか、である。

読者は PR 説明より広い。誤判定の影響は、出荷内容の誤認である。公開は人が決める。

### 5. 障害メモまたはインシデントメモ

単位はメモ1件。集めるものは本文と、あれば関連するログやチケット識別子である。

コードが扱うのはチケット番号の形式、時刻、空の必須見出しである。Jev が扱うのは、影響範囲、再現、切り戻し、所有者の記述が揃っているか、推測を事実として書いていないか、である。

欠落を早く見せる用途である。誤判定の影響は、対応の優先度を間違えることである。障害票のクローズや外部送信は人が決める。

## 除外するもの

これ以外の用途を先に切らない。除外は次の5つだけである。

- 一般的な文章添削。Jev は校正器ではない。
- 構文、型、テスト、カバレッジ。コードで足りる判定を Jev に出さない。
- 「コードの品質」を1問で点数化すること。狭い質問に分解してコードで合成する。
- レポートを見てマージ、削除、公開、外部送信すること。閾値を通っても自動では行わない。
- チケット分類やモデレーションの汎用基盤。TypeSafe の用例にはあるが、このリポジトリの対象ではない。

## 構成

計画上の分割は次のとおりである。

- 設計スキル `create-jev-cheker-skill`。対象を調べ、チェックリスト案を出し、承認後に定義ファイルを書く。通常の検査ループには入らない。
- 対象別の checker 定義。承認済み質問、安定 ID、適用条件、閾値、バージョンを持つデータ。
- 共通 TypeScript ライブラリと CLI。入力検証、Jev の一括送信、閾値、欠落、失敗、対象外、使用量と時間の記録。
- Hook やプラグイン。イベントから自動で走らせたいときだけの薄い接続。最初のプログラムには入れない。

## 実行

Node 20 以上。

```bash
npm ci
npm run build
npm test
npx jev-check --definition <file> --input <file>
npx jev-check --dry-run --definition <file> --input <file>
npx jev-check --replay fixtures/replay/pass.json
```

定義の解析と承認の確認を先に行い、`TYPESAFE_API_KEY` は Jev に送る直前にだけ見る。キーが無いときは live 呼び出しをせず、終了コード 3 で止まる。`--dry-run` と `--replay` はキー無しで動く。キーはログにも出力にも出さない。

### 定義ファイル

`--definition` に渡す JSON。`approval.status` が `approved` でない定義は解析の時点で拒否し、`{ "error": ... }` を出して終了コード 2 で止まる。

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

- `id` は定義の安定 ID。`version` は 0 以上の整数。`questions` は 1 件以上で、質問の `id` は重複できない。
- `noul` は `passAt` 以上で pass、`failAt` 以下で fail、その間は review。省略時は 0.8 と 0.2。
- `choice` は `options` でラベルを pass、fail、review のどれかに対応させる。表にないラベルは review。
- `score` は `passAt` と `failAt` を noul と同じ帯として使う。両方とも必須。`criteria` は 2 件以上の配列。
- `passAt` が `failAt` 以下の定義は拒否する。
- `choice` と `score` の `confidenceFloor` は任意。`confidence` がこれを下回ると、対応先が pass でも review。
- `applyWhen` は任意。`{ "path": "a.b", "op": "exists" }` か `{ "path": "a.b", "op": "equals", "value": <JSON> }` で、`state` のドット区切りパスに対して評価する。偽なら Jev に送らず not_applicable にする。
- `instructions` と `criteria` はそのまま Jev に送る。`applyWhen`、閾値、`options` は送らない。

### 入力ファイル

`--input` に渡す JSON。`state` だけを読み、他のキーは無視する。replay ファイルをそのまま渡してもよい。

```json
{ "state": { "paragraph": "...", "claimsSource": true } }
```

### replay ファイル

`--replay` に渡す JSON。`answers` が Jev の代わりになり、ネットワークには出ない。`definition` は replay ファイルからの相対パスで、`--definition` を付ければそちらを使う。`--input` を付ければ `state` もそちらを使う。`usage` は任意。`answers` の形は SDK の応答と同じにする。

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

`fixtures/replay/` に pass、fail、review、not-applicable、missing-answer の 5 件がある。対象は短い英文段落のサンプルで、製品チェックリストではない。

### レポート

標準出力に JSON を 1 件出す。

- `definition` は定義の `id` と `version`。
- `items` は質問ごとの `id`、`verdict`、`reason`、あれば Jev の `answer`。定義の順に並ぶ。
- `usage` は `input_tokens` と `output_tokens`。Jev を呼ばなかったときは 0。
- `timing` は `wallMs` と `jevMs`。

マージ、削除、公開、送信を許可するフィールドは無い。`--dry-run` は Jev に送る予定の `state` と `questions` を出して終了コード 0 で止まり、`answers` を含まない。

### 終了コード

| コード | 意味 |
| --- | --- |
| 0 | すべての項目が pass か not_applicable |
| 1 | fail が 1 件以上ある |
| 2 | fail は無く、review か error が 1 件以上ある。または定義や入力ファイルを拒否した |
| 3 | `TYPESAFE_API_KEY` が無い、または Jev への送信に失敗した |

実装の順番と検証箱は [`docs/jev-checker-plan.md`](docs/jev-checker-plan.md) にある。
