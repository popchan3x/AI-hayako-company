# 無料データ監査レポート 2026-06-28

## 結論
監視対象91件のうち、無料データ取得可は0件、不足は0件、取得不可は0件、通信失敗は91件でした。

## 理由
今回の監査では、FX21件、貴金属4件、指数ETF15件、米国株20件、日本株20件、貴金属ETF・鉱山株11件を確認しました。

91件すべてで `fetch failed` が出たため、銘柄が無料データに未対応とは断定しません。現時点では、この実行環境から無料データ元へ接続できなかった状態として扱います。

優先度の上位20件は `data/universe/latest-universe-audit.md` に保存しました。上位は XAGUSD、XAUUSD、XPDUSD、AUDCAD、AUDCHF、AUDJPY、AUDUSD、CADCHF、EURGBP、EURJPY、EURUSD、GBPAUD、GBPCAD、GBPCHF、GBPJPY、GBPUSD、USDCAD、USDCHF、USDJPY、XPTUSD です。

## 確認した公開情報
- S&P Dow Jones Indices: S&P 500 は米国大型株の代表指標で、500社を含み、利用可能な時価総額の約80%をカバーしています。https://www.spglobal.com/spdji/en/indices/equity/sp-500/
- BIS: 2022年4月の外為取引では、米ドルが88%、ユーロが30.5%、日本円が17%、英ポンドが13%の取引に関わっています。https://www.bis.org/statistics/rpfx22_fx.htm
- JPX: TOPIX は日本株市場の広い範囲をカバーする指標で、浮動株調整後の時価総額で計算されます。https://www.jpx.co.jp/english/markets/indices/topix/
- SPDR Gold Shares: GLD は金市場に投資する代表的な上場商品です。https://www.spdrgoldshares.com/usa/
- iShares Silver Trust: SLV は銀価格に連動することを目指す商品で、2026-06-26時点の純資産は28,044,135,091ドルです。https://www.ishares.com/us/products/239855/ishares-silver-trust-fund
- VanEck Gold Miners ETF: GDX は金鉱株をまとめて見るための代表的な上場商品です。https://www.vaneck.com/us/en/investments/gold-miners-etf-gdx/

## 次のアクション
1. 推奨案: 無料データ元を2つ以上に増やし、通信失敗91件を0件に近づける。
2. 代替案: 証券会社やFX会社のデータ連携を使う。ただし、外部決済や個人情報には触れない。
3. 保留案: デモデータだけで画面改善を続ける。ただし、実データの強さ検証は進まない。

まずは推奨案で、無料データ元を最低2つ追加して、同じ91件を再監査するのが良いです。
