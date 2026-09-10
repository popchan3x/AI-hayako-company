# 相場分析AI 日次学習レポート - 2026-07-27

## 結論
- 指定コマンド `node scripts/daily-learn.js --provider=free-composite --intervals=1m,5m,15m,1h,4h,1d` は初回実行で一部時間足が内部タイムアウトしました。
- 回復実行として同じ provider と同じ 6 時間足に `--interval-timeout-ms=600000 --interval-timeout-1d-ms=900000` を追加し、全 6 時間足を成功させました。
- 分析対象は 91 対象です。
- 累計シグナルは 4,433 行、今回追加シグナルは 0 行です。
- 累計答え合わせは 13,107 行、今回追加答え合わせは 0 行です。
- 未評価の答え合わせは 192 件です。
- `npm.cmd test` は 22 件成功、0 件失敗です。
- 外部決済、個人情報、実売買、X への直接投稿は 0 件です。

## 理由
- 初回実行は 1m と 15m は成功しましたが、5m・1h・4h が各 240.1 秒で内部タイムアウトし、1d は完了前に待機上限へ到達しました。
- 回復実行では時間足ごとの上限を伸ばし、1m 205.6 秒、5m 229.1 秒、15m 222.6 秒、1h 260.5 秒、4h 269.8 秒、1d 847.7 秒ですべて成功しました。
- 合計実行時間は 2,035.7 秒です。
- 直近の学習データは既に保存済みと判定され、`signals.jsonl` と `outcomes.jsonl` の行数は増えませんでした。
- 成功サマリーでは、時間足別の答え合わせ件数は 1m 2,456 件、5m 2,295 件、15m 1,996 件、1h 2,275 件、4h 2,056 件、1d 1,406 件、時間足不明 623 件です。
- 時間足別の勝率は 1m 78.5%、5m 80.2%、15m 80.8%、1h 71.9%、4h 73.6%、1d 73.9%、時間足不明 37.7% です。
- モデル別では Range Reversion が 3,679 件で勝率 80.7%、Trend Breakout が 696 件で勝率 56.9% です。
- 信頼度別では 0-59 が 6,056 件で勝率 89.7%、90-100 が 646 件で勝率 44.0% です。高信頼度ほど勝率が下がる傾向が残っています。

## 失敗時の選択肢
1. 時間足ごとの上限を 600 秒、1d を 900 秒に伸ばして再実行する。推奨案として実施済みです。
2. 1m,5m,15m,1h,4h と 1d を分けて実行し、長い 1d の影響を切り離す。
3. `--stage=outcomes` を単独で実行し、答え合わせ保存だけを短時間で確認する。

## 次のアクション
1. 次回の日次学習でも 1d は 847.7 秒かかったため、1d のタイムアウト上限は 900 秒以上を維持します。
2. 高信頼度 90-100 の勝率 44.0% を改善するため、信頼度の付け方を見直します。
3. Trend Breakout は平均損益 -1.0327 と最も弱いため、重みを下げるか条件を狭くします。
4. `data/learning/learning-summary.md` は日本語文字化けが残るため、次回以降に文字コードか出力処理を修正します。

## 保存ファイル
- 初回学習ログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\daily-learn-20260727-125413.out.log`
- 初回学習エラーログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\daily-learn-20260727-125413.err.log`
- 回復学習ログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\daily-learn-recovery-20260727-133100.out.log`
- 回復学習エラーログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\daily-learn-recovery-20260727-133100.err.log`
- テストログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\npm-test-20260727-140600.out.log`
- テストエラーログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\npm-test-20260727-140600.err.log`
- 本レポート: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\market-ai-daily-learning-2026-07-27.md`
