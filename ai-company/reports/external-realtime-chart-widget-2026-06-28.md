# 外部リアルタイムチャート導入レポート（2026-06-28）

## 結論

TradingView公式ウィジェットをアプリに追加しました。これで、自前の簡易チャートだけでなく、TradingViewの見慣れた詳細チャートをアプリ内で確認できます。

ただし、すべての銘柄が完全リアルタイムとは限りません。銘柄、取引所、TradingView側の条件によって遅延表示になる場合があります。

## 理由

- 既存チャートはAI分析用の補助表示としては使えますが、実際の波形確認ではTradingViewのような操作性と細かい表示が必要です。
- TradingViewには公式の埋め込み用チャートがあり、Webアプリに表示できます。
- 価格データをこちらで無理に抜き取るのではなく、公式ウィジェットを表示するため、安全性と権利面のリスクを抑えられます。

## 実装内容

- `public/index.html`
  - TradingView用の表示領域を追加しました。
- `public/app.js`
  - アプリ内の監視対象をTradingViewの銘柄名に変換する処理を追加しました。
  - 選択銘柄に合わせてTradingView公式チャートを読み込む処理を追加しました。
- `public/styles.css`
  - TradingViewチャートを大きく見やすく表示する領域を追加しました。

## 対応した銘柄変換

- XAUUSD、XAGUSD、XPTUSD、XPDUSD: OANDA形式
- 主要21 FXペア: FX形式
- 日本株と日本ETF: TSE形式
- 米国株と米国ETF: NASDAQ、NYSE、AMEX形式

## 検証結果

- JavaScript構文確認: 成功
- テスト: 13件中13件成功
- アプリ配信確認:
  - TradingView表示領域: あり
  - TradingView公式スクリプト: あり
  - XAUUSDのOANDA変換: あり
  - CSS表示領域: あり
- TradingView公式スクリプトURL確認: HTTP 200

## 注意点

- TradingViewウィジェットは表示用です。アプリ側でTradingViewの価格データを保存したり、売買エンジンへ直接渡したりはしません。
- リアルタイムか遅延かは銘柄ごとに異なります。
- TradingViewの有料プランでリアルタイムデータを購読しても、埋め込み先サイトの全ユーザーにそのまま反映されるわけではありません。
- 将来自動売買に使う価格データは、公式または契約済みのデータ提供元を別に用意する必要があります。

## 参考

- TradingView Advanced Chart Widget: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- TradingView Data FAQ: https://www.tradingview.com/widget-docs/faq/data/
- TradingView Dynamic Symbols: https://www.tradingview.com/widget-docs/tutorials/build-page/dynamic-symbols/

## 次のアクション

1. TradingViewチャートを実際にブラウザで確認し、XAUUSD、USDJPY、SPY、7203JPの4件で表示できるか見る。
2. 表示できない銘柄があれば、TradingView側の銘柄名を1件ずつ修正する。
3. 自動売買に進む前に、売買判断用データはTradingView表示とは別に、契約可能な価格データ候補を3つ比較する。
