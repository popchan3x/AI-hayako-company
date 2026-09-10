# 世界的トレーダー手法の取り込み 2026-06-30

## 結論
相場分析AIに「世界的トレーダー手法」分析を追加しました。6組の考え方を100点満点で照合し、最高級分析、分析材料、画面表示に反映します。

## 理由
1つのモデルだけでは、流れが出る相場、横ばい相場、重要予定前、荒い相場への対応が弱くなります。実績あるトレーダーの考え方を「確認リスト」として入れることで、売買方向だけでなく、攻めてよい場面と待つべき場面を分けやすくなります。

## 取り込んだ6つの型
1. Richard Dennis / Turtle Traders
   - 20本・55本の高値安値抜けを確認
   - 値動き幅を損切りの目安にする
   - 横ばい相場ではだましを警戒する

2. Ed Seykota
   - 平均線と傾きがそろう方向を見る
   - 感情ではなく、同じ条件で機械的に見る
   - 合わない時は何もしない

3. Paul Tudor Jones
   - 利益より先に守りを確認する
   - 損切り幅、利確幅、荒い値動き、重要予定を確認する
   - 条件が悪い時は信頼度を上げない

4. Stanley Druckenmiller / George Soros
   - 対象だけでなく、周辺市場と大きな流れを見る
   - 市場連動が逆風なら攻めない
   - 材料がそろう時だけ強く見る

5. Jim Simons / Renaissance Technologies
   - 感覚より検証結果を優先する
   - 過去検証、モデル一致度、データ品質を見る
   - 非公開手法そのものではなく、検証重視の考え方だけを使う

6. William O'Neil / Mark Minervini
   - 株やETFでは、強い流れ、値幅の縮小、上限突破、出来高増加を見る
   - FXや貴金属では補助材料として扱う

## 実装内容
- 新規追加: `src/traderPlaybooks.js`
- 更新: `src/analyzer.js`
- 更新: `src/worldClassIntelligence.js`
- 更新: `public/index.html`
- 更新: `public/app.js`
- 更新: `public/styles.css`
- 更新: `docs/market-ai-methodology.md`
- 更新: `tests/analyzer.test.js`

## 表示内容
- 総合点: 0から100
- 6組ごとの点数
- 判定
- 一致度
- 見ている材料
- 使い方
- 注意点

## 確認結果
- 自動テスト: 19件成功、0件失敗
- API確認: XAUUSDで巨匠手法6件、総合79/100
- ブラウザ確認: 「世界的トレーダー手法」欄が表示され、6件のカードが出ることを確認
- 全体スキャン: 91件完了表示
- 起動URL: http://127.0.0.1:3028/

## 参考リンク
- Turtle Traders: https://www.turtletrader.com/rules/
- Ed Seykota: https://en.wikipedia.org/wiki/Ed_Seykota
- Paul Tudor Jones: https://en.wikipedia.org/wiki/Paul_Tudor_Jones
- Stanley Druckenmiller: https://en.wikipedia.org/wiki/Stanley_Druckenmiller
- Jim Simons: https://en.wikipedia.org/wiki/Jim_Simons
- CAN SLIM: https://www.investors.com/ibd-university/can-slim/
- Mark Minervini: https://www.businessinsider.com/stock-trader-shares-easy-chart-pattern-he-trades-2024-8

## 次のアクション
1. 実データで、巨匠手法スコアが高い時の勝率を日次学習に保存する
2. 銘柄別に、どの手法が効きやすいかを集計する
3. 30件以上たまったら、巨匠手法スコアを信頼度補正に使う
