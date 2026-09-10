# 相場分析AI 日次学習レポート 2026-07-12

## 結論
- 日次学習は完了しました。終了コードは0です。
- 対象は91銘柄 x 6足 = 546枠です。
- 6足すべて完了しました。失敗した足は0件です。
- 今回の追加保存は、シグナル0件、答え合わせ0件です。
- 現在の保存総数は、シグナル3341行、答え合わせ9512行です。
- シグナルのユニーク件数は3250件、重複は91件です。
- 答え合わせのユニーク件数は2833件、重複は6679件です。
- 未評価は511件です。
- `npm.cmd test` は22件成功、失敗0件です。
- 外部決済、個人情報、実売買、Xへの直接投稿は実施していません。

## 理由
- 実行コマンドは `node scripts/daily-learn.js --provider=free-composite "--intervals=1m,5m,15m,1h,4h,1d"` です。
- 実行時間は約803秒です。
- 分割実行の結果は、1mが61.4秒、5mが62.2秒、15mが62.3秒、1hが71.1秒、4hが131.0秒、1dが414.1秒です。
- 6足すべて `ok: true`、タイムアウト0件、失敗0件でした。
- 実行前後で保存件数が変わらず、シグナルは3341行のまま、答え合わせは9512行のままでした。
- 最新の保存日は2026-07-09です。2026-07-09は1m、5m、15m、1h、4h、1dの各91件、合計546件が保存済みです。
- `learning-summary.json` は2026-07-12T06:17:18.305Zに更新され、総数はシグナル3341件、答え合わせ9512件、未評価511件でした。
- `learning-summary.md` の本文は文字化けしていたため、今回の数字は `learning-summary.json`、保存ファイル、実行ログから確認しました。

## 次のアクション
1. 次回の営業日データが出た後に、同じ6足で再実行します。
2. `learning-summary.md` の文字化けを修正し、チャット外でも日本語で読める要約にします。
3. 答え合わせの重複6679件を別作業で整理するか、保存時に同じ答え合わせを増やさない仕組みを確認します。

## 保存ログ
- 学習ログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\daily-learn-20260712-150356.out.log`
- 学習エラーログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\daily-learn-20260712-150356.err.log`
- テストログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\npm-test-20260712-151758.out.log`
- テストエラーログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\npm-test-20260712-151758.err.log`
