# 推奨コミットメッセージ（2026-06-28）

## 結論

推奨コミットメッセージは次です。

```text
feat: improve market AI charts, timeframes, and auto learning
```

## 理由

- 自前チャートを改善しました。
- 1分、5分、15分、1時間、4時間、日足の6時間足に対応しました。
- TradingView公式チャート表示を追加しました。
- 無料データ取得の証明書失敗対策を追加しました。
- 日次学習を毎日9:00に自動実行できる形にしました。
- 分析材料を8項目で見える化しました。
- テストを15件に増やしました。

## 詳細版

```text
feat: improve market AI charts, timeframes, and auto learning

- add TradingView chart widget and improve local candlestick chart
- support 1m, 5m, 15m, 1h, 4h, and 1d analysis intervals
- add visible analysis material cards for signal reasoning
- add Windows trust fallback for free data fetch failures
- add scheduled daily learning across all tracked intervals
- expand tests for intraday data and analysis materials
```

## 次のアクション

1. すべてまとめてコミットするなら、上の推奨メッセージを使う。
2. データ更新とアプリ実装を分けたい場合は、2コミットに分ける。
3. 今回はアプリ本体の変更が中心なので、1コミット運用を推奨する。
