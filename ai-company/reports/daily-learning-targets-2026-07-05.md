# 日次学習の対象銘柄と時間足 - 2026-07-05

## 結論
日次学習の対象は91銘柄です。

時間足は6種類です。対象は `1m`、`5m`、`15m`、`1h`、`4h`、`1d` です。

全銘柄と全時間足が保存できた場合、1日あたりの新規シグナルは最大546件です。

## 理由
銘柄は `src/assets.js` の `ASSETS` で定義されています。

時間足は `package.json` の `learn:daily`、`learn:signals`、`learn:outcomes` で `--intervals=1m,5m,15m,1h,4h,1d` として指定されています。

2026-07-05時点の保存済みデータでは、`signals.jsonl` に91銘柄すべてが少なくとも1回入っています。

保存済みシグナルは2,270件、保存済み答え合わせは5,864件です。

## 時間足
| 時間足 | 意味 |
| --- | --- |
| 1m | 1分足 |
| 5m | 5分足 |
| 15m | 15分足 |
| 1h | 1時間足 |
| 4h | 4時間足 |
| 1d | 日足 |

## 銘柄一覧
### 指数ETF: 15銘柄
SPY, QQQ, DIA, IWM, VTI, RSP, SMH, SOXX, TLT, HYG, VIXY, EWJ, DXJ, 1321JP, 1306JP

### 米国株: 20銘柄
NVDA, AAPL, MSFT, AMZN, GOOGL, META, TSLA, AVGO, AMD, TSM, ASML, ORCL, PLTR, JPM, BAC, XOM, CVX, LLY, UNH, COST

### 日本株: 20銘柄
7203JP, 6758JP, 8035JP, 6857JP, 6861JP, 9984JP, 9983JP, 7974JP, 6501JP, 7011JP, 8306JP, 8316JP, 6098JP, 9432JP, 7267JP, 8058JP, 8031JP, 6146JP, 6920JP, 4063JP

### FX: 21銘柄
EURUSD, USDJPY, GBPUSD, AUDUSD, USDCAD, USDCHF, EURJPY, EURGBP, EURAUD, EURCAD, EURCHF, GBPJPY, GBPAUD, GBPCAD, GBPCHF, AUDJPY, AUDCAD, AUDCHF, CADJPY, CADCHF, CHFJPY

### 貴金属: 4銘柄
XAUUSD, XAGUSD, XPTUSD, XPDUSD

### 貴金属ETF・鉱山株: 11銘柄
GLD, SLV, PPLT, PALL, GDX, GDXJ, NEM, GOLD, AEM, PAAS, WPM

## 現在の保存状況
| 区分 | 件数 |
| --- | ---: |
| 保存済みシグナル | 2,270 |
| 保存済み答え合わせ | 5,864 |
| 保存済みに含まれる銘柄 | 91 |
| 未保存の銘柄 | 0 |

## 保存済みシグナルの時間足別件数
| 時間足 | 累計シグナル |
| --- | ---: |
| 1m | 455 |
| 5m | 364 |
| 15m | 273 |
| 1h | 421 |
| 4h | 364 |
| 1d | 226 |
| 不明 | 167 |

## 2026-07-05分の保存済みシグナル
| 時間足 | 件数 |
| --- | ---: |
| 1m | 91 |
| 5m | 91 |
| 1h | 91 |
| 15m | 0 |
| 4h | 0 |
| 1d | 0 |

## 次のアクション
1. 今日分の未保存を埋めるなら、まず `npm.cmd run learn:signals` を実行する。
2. シグナル保存後に `npm.cmd run learn:outcomes` で答え合わせを進める。
3. 実行後に `signals.jsonl`、`outcomes.jsonl`、`learning-summary.json` の件数を確認する。
