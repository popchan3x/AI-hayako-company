# CMO調査レポート: 相場分析AIの頭脳拡張 2026-06-29

## 結論
今日はCTOとCFOの作業は止め、CMOとして相場分析AIに追加すべき情報源と分析視点を調査した。公開ページと公式情報を中心に32件の候補を整理し、すぐ増やすべき頭脳を10項目にまとめた。

日次学習は通常どおり進んでいる。最新記録は2026-06-29 09:22:16 JST相当で、対象時間足は6種類、累計シグナルは713件、新規シグナルは546件、累計答え合わせは480件、新規答え合わせは207件、未評価は1,659件だった。

## 理由
今の分析AIは価格の形からの判定が中心で、世界トップ級を狙うには「何を見るか」をもっと増やす必要がある。特に短期売買では、チャート、出来高、ニュース、金利、通貨、指数、貴金属、重要予定、過去の答え合わせを同時に見るほど判断の土台が強くなる。

競合や参考サービスを見ると、強い投資ツールは3つの特徴を持っていた。1つ目はTradingViewのようにチャートを見やすく、時間足をすばやく切り替えられること。2つ目はTrendSpiderやTickeronのように、パターンや売買候補を自動で探すこと。3つ目はKoyfinのように、株、指数、通貨、金利、ニュースを1画面で比較できること。

## 今日確認した日次学習
- データ作成時刻: 2026-06-29T00:22:16.266Z
- データ提供元: free-composite
- 時間足: 1分、5分、15分、1時間、4時間、日足の6種類
- 累計シグナル: 713件
- 今日の新規シグナル: 546件
- 累計答え合わせ: 480件
- 今日の新規答え合わせ: 207件
- 未評価シグナル: 1,659件

現時点では「勝率だけが高くても損益が悪い」候補がある。次に強くするには、勝ち負けだけでなく、1回あたりの損益、最大下落、時間帯、手数料込みの結果を同時に見る必要がある。

## 追加すべき情報カテゴリ 8件
1. チャート情報: 価格、出来高、時間足、ローソク足、移動平均、値幅
2. 市場全体の温度: S&P 500、NASDAQ、日経平均、VIX、米国金利、ドル指数
3. 通貨の力関係: 米ドル、ユーロ、日本円、ポンド、豪ドル、カナダドル、スイスフラン
4. 貴金属の流れ: XAUUSD、XAGUSD、XPTUSD、XPDUSD、金鉱株ETF
5. 重要予定: FOMC、CPI、雇用統計、決算、中央銀行発表
6. ニュースと空気感: 世界ニュース、企業発表、SNSの急変、検索需要
7. プロ用データ: 金利、CFTC建玉、SEC開示、LBMA価格、公式統計
8. 答え合わせ: シグナル後の結果、時間帯別の成績、銘柄別の得意不得意

## すぐ増やすべき頭脳 10項目
1. 複数時間足の一致判定: 1分、5分、15分、1時間、4時間、日足の方向がそろうかを見る
2. 重要予定フィルター: 指標発表の前後30分は信頼度を下げる
3. 市場連動マップ: 金利、ドル、金、株価指数、VIXのつながりを見る
4. ニュース急変検知: GDELTなどで急に話題が増えたテーマを拾う
5. 貴金属専用材料: LBMA価格、ドル、米金利、金鉱株ETFを一緒に見る
6. 通貨強弱表: 主要7通貨を総当たりで比べ、強い通貨と弱い通貨を出す
7. 勝ち筋スコアの説明強化: なぜ今買うか、なぜ待つかを3行で出す
8. データ品質スコア: 欠損、遅延、通信失敗がある時は分析不可にする
9. 戦略大会の定期更新: ルール型、指標型、時系列AI型を毎日同条件で比べる
10. 自己学習メモリ: 銘柄、時間帯、相場環境ごとの成功例と失敗例をためる

## 調査した候補 32件
1. TradingView Advanced Chart Widget: 自前チャート改善、時間足切替、見やすい表示の参考
2. TradingView Dynamic Symbols: 選択銘柄に合わせたチャート切替の参考
3. TradingView Screener: 銘柄の広い監視と絞り込みの参考
4. TrendSpider: 自動の線引き、複数時間足、アラート、検証画面の参考
5. Tickeron: AIシグナル、確率表示、売買候補の見せ方の参考
6. Koyfin: 株、指数、為替、金利、ニュースを並べる画面設計の参考
7. Polygon.io: 株、為替、暗号資産などの市場データ候補
8. Alpha Vantage: 無料から使える価格データ候補
9. Nasdaq Data Link: 公式系と代替データの候補
10. Finnhub: 株、為替、企業情報、ニュース候補
11. Twelve Data: 複数市場の価格データ候補
12. Tiingo: 株価、為替、ニュース候補
13. FRED: 米国金利、景気、物価などの公式統計
14. BLS: 米雇用、CPIなどの公式統計
15. BEA: GDP、個人消費などの公式統計
16. Federal Reserve: FOMC、金利、発表文の公式情報
17. US Treasury: 米国債利回りの公式情報
18. CFTC COT: 先物の大口建玉情報
19. SEC EDGAR: 企業開示、決算、重要書類
20. LBMA Precious Metal Prices: 金、銀、プラチナ、パラジウム価格の公式系情報
21. World Gold Council: 金の需給やETF保有量の参考
22. CME Group: 先物、金利、商品、経済予定の参考
23. GDELT: 世界ニュースの量と内容を拾う候補
24. Google Trends: 検索需要の急変を拾う候補
25. Earnings Calendar: 決算日前後のリスク検知
26. Backtrader: 売買ルールの検証基盤候補
27. QuantConnect LEAN: 複数市場の検証基盤候補
28. vectorbt: 大量の条件を高速に比べる検証候補
29. Temporal Fusion Transformer: 複数材料を使う時系列AIの候補
30. PatchTST: 価格系列の特徴を学ぶAI候補
31. TimesNet: 時系列の周期性を学ぶAI候補
32. FinGPT: 金融ニュースや文章理解の候補

## 次のアクション
1. 2026-06-29中に、アプリの頭脳候補として「市場連動マップ」「重要予定フィルター」「データ品質スコア」の3つを最優先で設計する。
2. 2026-06-30以降、日次学習の保存先に「銘柄、時間足、相場環境、使った材料、結果」の5項目を必ず残す。
3. 7日分の記録がたまったら、勝率、損益、最大下落、手数料込み成績の4つで戦略を並べ替える。

## 注意点
- 今日の作業ではXへの直接投稿はしない。
- 外部決済、個人情報、証券口座には触れない。
- 有料データや外部サービス連携は、料金、利用条件、再配布可否を確認してから使う。
- 投資助言に見える表現は、有料提供前に必ず確認する。

## 参考リンク
- TradingView Advanced Chart Widget: https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/
- TradingView Dynamic Symbols: https://www.tradingview.com/widget-docs/tutorials/build-page/dynamic-symbols/
- TradingView Features: https://www.tradingview.com/features/
- TrendSpider: https://trendspider.com/
- Tickeron: https://tickeron.com/
- Koyfin: https://www.koyfin.com/
- Polygon.io Docs: https://polygon.io/docs
- Alpha Vantage Docs: https://www.alphavantage.co/documentation/
- Nasdaq Data Link: https://data.nasdaq.com/
- FRED: https://fred.stlouisfed.org/
- GDELT: https://www.gdeltproject.org/
- LBMA Precious Metal Prices: https://www.lbma.org.uk/prices-and-data/precious-metal-prices
- Backtrader: https://www.backtrader.com/
- QuantConnect LEAN: https://www.quantconnect.com/lean
- TFT paper: https://arxiv.org/abs/1912.09363
- FinGPT search/paper入口: https://arxiv.org/search/?query=FinGPT&searchtype=all
