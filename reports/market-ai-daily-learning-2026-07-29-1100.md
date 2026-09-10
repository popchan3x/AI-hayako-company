# 相場分析AI 日次学習レポート 2026-07-29 11:00 JST

## 結論
- 指定コマンドは成功しました。
- 実行コマンド: `node scripts/daily-learn.js --provider=free-composite --intervals=1m,5m,15m,1h,4h,1d`
- 分析対象は91対象、時間足は6種類です。
- 6時間足の実行は6件成功、0件失敗でした。
- 累計シグナルは4,433件、累計答え合わせは13,107件、未評価は192件です。
- 今回の新規シグナルは0件、新規答え合わせは0件でした。
- `npm.cmd test` は22件成功、0件失敗でした。
- 外部決済、個人情報、実売買、Xへの直接投稿は行っていません。

## 理由
- 前回実行は2026-07-29 01:54:50 JSTで、今回も同じ2026-07-29の日次キーで実行したため、重複保存防止により新規追加は0件でした。
- 分割実行の合計時間は700.2秒でした。
- 時間足別の実行時間は、1mが49.2秒、5mが57.7秒、15mが57.0秒、1hが61.7秒、4hが65.2秒、1dが409.4秒でした。
- 時間足別の答え合わせ成績は、1mが2,456件で勝率78.5%、5mが2,295件で勝率80.2%、15mが1,996件で勝率80.8%、1hが2,275件で勝率71.9%、4hが2,056件で勝率73.6%、1dが1,406件で勝率73.9%、unknownが623件で勝率37.7%でした。
- モデル別ではRange Reversionが3,679件で勝率80.7%、Volatility Squeezeが3,298件で勝率68.9%、Time Series Momentumが2,867件で勝率75.5%、Indicator Compositeが2,567件で勝率78.0%、Trend Breakoutが696件で勝率56.9%でした。
- 平均損益は主要5モデルすべてマイナスで、Trend Breakoutが-1.0327、Volatility Squeezeが-0.3354、Indicator Compositeが-0.1952、Time Series Momentumが-0.1135、Range Reversionが-0.1059でした。
- 信頼度別では0-59が6,056件で勝率89.7%、60-69が2,340件で勝率77.5%、70-79が1,512件で勝率57.2%、80-89が2,553件で勝率55.2%、90-100が646件で勝率44.0%でした。
- 直近の保存ファイルは `data/learning/signals.jsonl` が4,433行、`data/learning/outcomes.jsonl` が13,107行です。
- `data/learning/learning-summary.json` と `data/learning/learning-summary.md` は2026-07-29 11:00:15 JSTに更新されました。
- 注意点として、分割実行の保存済み `learning-summary.json` は最後の子実行である `1d` のinterval表示になります。今回レポートでは標準出力の分割実行結果を使い、6時間足すべての成功を記録しました。

## 次のアクション
1. 明日の自動実行まで待ち、日付キーが変わった状態で新規シグナルを91対象 x 6時間足分保存します。
2. 信頼度90-100の646件は勝率44.0%のため、信頼度補正を優先して見直します。
3. Trend Breakoutの696件は平均損益-1.0327のため、採用条件を厳しくするか、重みを下げる判断を行います。
4. `unknown` 時間足623件は勝率37.7%のため、過去データの時間足ラベルを補正します。
5. 分割実行後の `learning-summary.json` が最後の時間足表示になる点を修正候補として扱います。

## 保存先
- シグナル: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\data\learning\signals.jsonl`
- 答え合わせ: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\data\learning\outcomes.jsonl`
- 学習サマリーJSON: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\data\learning\learning-summary.json`
- 学習サマリーMarkdown: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\data\learning\learning-summary.md`
- 今回レポート: `C:\Users\hyto0\Documents\AI hayako-company\ai-company\reports\market-ai-daily-learning-2026-07-29-1100.md`

## テスト
- 実行コマンド: `npm.cmd test`
- 結果: 22件成功、0件失敗
- Node test実行時間: 1,940.964ミリ秒

## Slack
- 開始通知: https://w1727600632-cmq117268.slack.com/archives/C0BDGAEAY3G/p1785289722484179
- 完了通知: https://w1727600632-cmq117268.slack.com/archives/C0BDGAEAY3G/p1785290607246169
