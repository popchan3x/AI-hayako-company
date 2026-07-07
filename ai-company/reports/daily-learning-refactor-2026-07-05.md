# daily-learn.js 分割修正レポート - 2026-07-05

## 結論
`daily-learn.js` の日次学習を「シグナル保存」と「答え合わせ保存」に分けました。

シグナル保存が終わった時点で `learning-summary.json` と `learning-summary.md` を更新するようにしました。

`npm.cmd test` は20件成功、0件失敗です。

外部決済、個人情報、実売買、Xへの直接投稿は0回です。

## 理由
これまでの処理は、シグナル保存後に過去分を含む全シグナルの答え合わせを進め、最後にだけサマリーを更新していました。

そのため、答え合わせ中に止まると、`signals.jsonl` には新規シグナルが保存済みなのに、`learning-summary.json` が古いままになる問題がありました。

今回の修正で、`runDailyLearning` は次の3つの実行形に対応しました。

1. `stage=all`: シグナル保存、途中サマリー更新、答え合わせ保存、最終サマリー更新を行う。
2. `stage=signals`: シグナル保存とサマリー更新だけを行う。
3. `stage=outcomes`: 保存済みシグナルの未評価分だけを答え合わせする。

答え合わせでは、すでに4本後、8本後、16本後の評価がそろっているシグナルを読み飛ばすようにしました。

シグナル保存では、すでに `日付|提供元|時間足|銘柄` が保存済みの銘柄は分析前に読み飛ばすようにしました。

これにより、再実行時に毎回すべての保存済みシグナルへ分析や価格データ取得をかける量を減らします。

## 変更ファイル
- `src/learning.js`: シグナル保存後の途中サマリー更新、答え合わせ対象の絞り込み、`stage` 指定を追加。
- `scripts/daily-learn.js`: `--stage=all|signals|outcomes` を受け取れるように変更。
- `package.json`: `learn:signals` と `learn:outcomes` を追加。
- `tests/analyzer.test.js`: シグナル保存だけでサマリーが書かれること、答え合わせだけでシグナルが増えないことを確認するテストを追加。

## 確認結果
`npm.cmd test` の結果は20件成功、0件失敗、実行時間1,966.022ミリ秒です。

追加したテストは1件で、`daily learning can save signals and summary before outcome evaluation` が成功しました。

## 次のアクション
1. 未保存の2026-07-05分について、まず `npm.cmd run learn:signals` で15m、4h、1dを含むシグナル保存を完了させる。
2. 次に `npm.cmd run learn:outcomes` で未評価分の答え合わせを進める。
3. 実行後に `signals.jsonl`、`outcomes.jsonl`、`learning-summary.json` の件数と重複数を確認する。
