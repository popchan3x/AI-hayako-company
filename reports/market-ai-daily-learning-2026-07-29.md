# 相場分析AI 日次学習レポート 2026-07-29

## 結論
- 指定コマンドは成功しました。
- 6時間足 `1m,5m,15m,1h,4h,1d` はすべて完了し、失敗は0本でした。
- 分析対象は91対象でした。
- 累計シグナルは4,433行、累計答え合わせは13,107行です。
- 今回の新規追加はシグナル0行、答え合わせ0行でした。
- 未評価の答え合わせは192件です。
- `npm.cmd test` は22件成功、0件失敗でした。

## 理由
- 実行コマンド: `node scripts/daily-learn.js --provider=free-composite --intervals=1m,5m,15m,1h,4h,1d`
- 実行開始: 2026-07-29 01:56:45 +09:00
- 学習サマリー更新: 2026-07-29 02:11:49 +09:00
- 実行時間: 約904.7秒
- 実行ログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\logs\market-ai-daily-learning-20260729-015645.out.log`
- エラーログ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\logs\market-ai-daily-learning-20260729-015645.err.log`
- 保存ファイル:
  - `C:\Users\hyto0\Documents\AI hayako-company\ai-company\data\learning\signals.jsonl`
  - `C:\Users\hyto0\Documents\AI hayako-company\ai-company\data\learning\outcomes.jsonl`
  - `C:\Users\hyto0\Documents\AI hayako-company\ai-company\data\learning\learning-summary.json`
  - `C:\Users\hyto0\Documents\AI hayako-company\ai-company\data\learning\learning-summary.md`

## 時間足別の実行時間
| 時間足 | 結果 | 実行時間 |
| --- | --- | ---: |
| 1m | 成功 | 57.3秒 |
| 5m | 成功 | 79.9秒 |
| 15m | 成功 | 86.8秒 |
| 1h | 成功 | 90.1秒 |
| 4h | 成功 | 94.5秒 |
| 1d | 成功 | 495.1秒 |

## 時間足別の答え合わせ成績
| 時間足 | 件数 | 勝ち | 勝率 | 平均損益 |
| --- | ---: | ---: | ---: | ---: |
| 1m | 2,456 | 1,927 | 78.5% | -0.0404 |
| 5m | 2,295 | 1,840 | 80.2% | -0.0233 |
| 15m | 1,996 | 1,613 | 80.8% | -0.0481 |
| 1h | 2,275 | 1,636 | 71.9% | -0.2481 |
| 4h | 2,056 | 1,513 | 73.6% | -0.5555 |
| 1d | 1,406 | 1,039 | 73.9% | -0.4140 |
| unknown | 623 | 235 | 37.7% | -0.8081 |

## モデル別の答え合わせ成績
| モデル | 件数 | 勝ち | 勝率 | 平均損益 |
| --- | ---: | ---: | ---: | ---: |
| Range Reversion | 3,679 | 2,969 | 80.7% | -0.1059 |
| Volatility Squeeze | 3,298 | 2,271 | 68.9% | -0.3354 |
| Time Series Momentum | 2,867 | 2,165 | 75.5% | -0.1135 |
| Indicator Composite | 2,567 | 2,002 | 78.0% | -0.1952 |
| Trend Breakout | 696 | 396 | 56.9% | -1.0327 |

## 信頼度別の答え合わせ成績
| 信頼度 | 件数 | 勝率 |
| --- | ---: | ---: |
| 0-59 | 6,056 | 89.7% |
| 60-69 | 2,340 | 77.5% |
| 70-79 | 1,512 | 57.2% |
| 80-89 | 2,553 | 55.2% |
| 90-100 | 646 | 44.0% |

## 注意点
- 最新シグナルの生成時刻は `2026-07-22T08:33:40.308Z` のままでした。
- 今回は重複判定により新規シグナルと新規答え合わせが0行でした。
- `learning-summary.md` と一部ラベルには日本語文字化けが残っています。
- 勝率は全体で約74.8%ですが、モデル別の平均損益はすべてマイナスです。
- 信頼度90-100の勝率は44.0%で、信頼度が高いほど勝率が下がる傾向が残っています。

## 次のアクション
- 信頼度90-100の646件を優先して、信頼度補正を見直します。
- Trend Breakoutの696件、平均損益-1.0327を優先して改善します。
- `unknown` 時間足623件の発生元を確認し、時間足ラベルを補正します。
- `learning-summary.md` の文字化けを直し、次回から日本語で読める状態にします。

## テスト
- 実行コマンド: `npm.cmd test`
- 結果: 22件成功、0件失敗
- 実行時間: 2,895.3ミリ秒

## Slack
- 開始通知: https://w1727600632-cmq117268.slack.com/archives/C0BDGAEAY3G/p1785257797980689
- 最終通知: https://w1727600632-cmq117268.slack.com/archives/C0BDGAEAY3G/p1785258885608819
