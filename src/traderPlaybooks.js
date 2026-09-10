import { ema, round, sma } from "./indicators.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function previousChannel(candles, period) {
  const slice = candles.slice(Math.max(0, candles.length - period - 1), -1);
  if (!slice.length) return null;
  return {
    high: Math.max(...slice.map((candle) => candle.high ?? candle.close)),
    low: Math.min(...slice.map((candle) => candle.low ?? candle.close))
  };
}

function normalizedRange(candle) {
  const close = candle.close || 1;
  return Math.abs((candle.high ?? close) - (candle.low ?? close)) / Math.max(Math.abs(close), 0.0001);
}

function recentCompression(candles) {
  if (candles.length < 36) return { score: 45, detail: "圧縮確認には36本以上の足が必要です。" };
  const recent = candles.slice(-6);
  const prior = candles.slice(-36, -6);
  const recentRange = average(recent.map(normalizedRange)) ?? 0;
  const priorRange = average(prior.map(normalizedRange)) ?? recentRange;
  const recentVolume = average(recent.map((candle) => candle.volume || 0)) ?? 0;
  const priorVolume = average(prior.map((candle) => candle.volume || 0)) ?? recentVolume;
  const rangeRatio = priorRange > 0 ? recentRange / priorRange : 1;
  const volumeRatio = priorVolume > 0 ? recentVolume / priorVolume : 1;
  const score = clamp(92 - rangeRatio * 50 - Math.max(0, volumeRatio - 0.9) * 22);

  return {
    score: Math.round(score),
    rangeRatio,
    volumeRatio,
    detail: `直近6本の値幅は前30本平均の${round(rangeRatio, 2)}倍、出来高は${round(volumeRatio, 2)}倍です。`
  };
}

function trendAlignment(features, candles) {
  const closes = candles.map((candle) => candle.close);
  const ema21 = ema(closes, 21);
  const sma100 = sma(closes, 100);
  const sma200 = sma(closes, 200);
  const up = features.sma20 > features.sma50 && features.close > (ema21 ?? features.sma50) && (features.slope24 ?? 0) > 0;
  const down = features.sma20 < features.sma50 && features.close < (ema21 ?? features.sma50) && (features.slope24 ?? 0) < 0;
  const longBias = sma200 ? features.close > sma200 : sma100 ? features.close > sma100 : up;
  return { ema21, sma100, sma200, up, down, longBias };
}

function alignmentLabel(score) {
  if (score >= 78) return "かなり合う";
  if (score >= 62) return "一部合う";
  return "まだ弱い";
}

function directionFromBias(buyScore, sellScore) {
  if (buyScore >= sellScore + 10 && buyScore >= 62) return "買い寄り";
  if (sellScore >= buyScore + 10 && sellScore >= 62) return "売り寄り";
  return "待ち寄り";
}

function turtlePlaybook({ features, candles }) {
  const channel20 = previousChannel(candles, 20);
  const channel55 = previousChannel(candles, 55);
  const atrPercent = features.atr14 && features.close ? (features.atr14 / features.close) * 100 : 0;
  const buyBreak = channel20 && features.close >= channel20.high * 0.995;
  const sellBreak = channel20 && features.close <= channel20.low * 1.005;
  const longerBuy = channel55 && features.close >= channel55.high * 0.985;
  const longerSell = channel55 && features.close <= channel55.low * 1.015;
  const buyScore = 44 + (buyBreak ? 26 : 0) + (longerBuy ? 14 : 0) + (features.volumeRatio > 1.05 ? 8 : 0);
  const sellScore = 44 + (sellBreak ? 26 : 0) + (longerSell ? 14 : 0) + (features.volumeRatio > 1.05 ? 8 : 0);
  const score = clamp(Math.max(buyScore, sellScore) - (atrPercent > 3.5 ? 12 : 0));
  const signal = directionFromBias(buyScore, sellScore);

  return {
    trader: "Richard Dennis / Turtle Traders",
    method: "20本・55本の高値安値抜けを、値動き幅で守る",
    score: Math.round(score),
    signal,
    fit: alignmentLabel(score),
    detail: `20本上限${round(channel20?.high, 4)}、20本下限${round(channel20?.low, 4)}。値動き幅は価格の${round(atrPercent, 2)}%です。`,
    howToUse: "直近の上限下限を抜けた時だけ候補にし、損切りは値動き幅を基準に広すぎず狭すぎず置きます。",
    caution: "横ばい相場ではだましが増えるため、モデル大会と市場連動で確認します。"
  };
}

function seykotaPlaybook({ features, candles }) {
  const trend = trendAlignment(features, candles);
  const slopePercent = (features.slope24 ?? 0) / Math.max(features.close, 0.0001) * 100;
  const buyScore = 45 + (trend.up ? 28 : 0) + (trend.longBias ? 10 : 0) + (features.rsi14 > 50 ? 6 : 0);
  const sellScore = 45 + (trend.down ? 28 : 0) + (!trend.longBias ? 10 : 0) + (features.rsi14 < 50 ? 6 : 0);
  const score = clamp(Math.max(buyScore, sellScore));

  return {
    trader: "Ed Seykota",
    method: "機械的に流れへ乗り、逆行したら小さく撤退する",
    score: Math.round(score),
    signal: directionFromBias(buyScore, sellScore),
    fit: alignmentLabel(score),
    detail: `20本平均と50本平均、直近24本の傾き${round(slopePercent, 3)}%を確認しています。`,
    howToUse: "感情で判断せず、平均線と傾きがそろう方向だけを強く見ます。",
    caution: "売買回数を増やすための手法ではなく、合わない時は何もしない前提です。"
  };
}

function tudorJonesPlaybook({ features, signal, regime, dataQuality }) {
  const atrPercent = features.atr14 && features.close ? (features.atr14 / features.close) * 100 : 0;
  const riskPenalty = (regime.riskLevel === "高い" ? 18 : 0) + (dataQuality.score < 80 ? 14 : 0) + (atrPercent > 3 ? 10 : 0);
  const stopDistance = Math.abs((signal.entryPrice ?? features.close) - (signal.stopLoss ?? features.close)) / Math.max(features.close, 0.0001) * 100;
  const targetDistance = Math.abs((signal.takeProfit ?? features.close) - (signal.entryPrice ?? features.close)) / Math.max(features.close, 0.0001) * 100;
  const rewardRisk = stopDistance > 0 ? targetDistance / stopDistance : 0;
  const score = clamp(76 + Math.min(14, rewardRisk * 5) - riskPenalty);

  return {
    trader: "Paul Tudor Jones",
    method: "まず守り、損が大きくなる前に止める",
    score: Math.round(score),
    signal: score >= 72 ? "攻めてもよい候補" : "守り優先",
    fit: alignmentLabel(score),
    detail: `利確幅は損切り幅の${round(rewardRisk, 2)}倍、相場の危険度は${regime.riskLevel}です。`,
    howToUse: "損切り位置、重要予定、荒い値動きを先に確認し、条件が悪い時は見送ります。",
    caution: "勝てそうに見えても、守りの点数が低い時は信頼度を上げません。"
  };
}

function druckenmillerPlaybook({ signal, regime }) {
  const market = signal.marketLinkage;
  const linkageScore = market?.score ?? 50;
  const agreement = signal.modelAgreement ?? 0;
  const trendBonus = regime.trendStrength ? Math.min(12, Math.abs(regime.trendStrength) * 8) : 0;
  const score = clamp(linkageScore * 0.5 + agreement * 0.35 + 18 + trendBonus - (market?.status === "逆風" ? 18 : 0));

  return {
    trader: "Stanley Druckenmiller / George Soros",
    method: "大きな流れと周辺市場がそろう時だけ強く見る",
    score: Math.round(score),
    signal: market?.status === "追い風" && agreement >= 55 ? "大きな流れと一致" : market?.status === "逆風" ? "逆風注意" : "確認待ち",
    fit: alignmentLabel(score),
    detail: `市場連動は${market?.status ?? "未確認"}、モデル一致度は${agreement}%、相場環境は${regime.name}です。`,
    howToUse: "対象だけを見ず、ドル、金利、指数、関連銘柄の方向が同じかを確認します。",
    caution: "材料が割れている時は、方向よりも待つ判断を優先します。"
  };
}

function simonsPlaybook({ tournament, dataQuality, signal }) {
  const leader = tournament[0];
  const trades = leader?.metrics.trades ?? 0;
  const profitFactor = leader?.metrics.profitFactor ?? 0;
  const drawdown = leader?.metrics.maxDrawdown ?? 0;
  const sampleScore = clamp((trades / 10) * 35);
  const profitScore = clamp(profitFactor * 22);
  const drawdownPenalty = clamp(drawdown * 280, 0, 24);
  const score = clamp(34 + sampleScore + profitScore + dataQuality.score * 0.18 + signal.modelAgreement * 0.12 - drawdownPenalty);

  return {
    trader: "Jim Simons / Renaissance Technologies",
    method: "感覚より、検証結果と複数モデルの一致を重視する",
    score: Math.round(score),
    signal: score >= 72 ? "検証が支える候補" : "検証不足",
    fit: alignmentLabel(score),
    detail: `首位モデルは${leader?.name ?? "未計算"}、過去検証は${trades}回、利益倍率は${round(profitFactor, 2)}です。`,
    howToUse: "思いつきの説明ではなく、同じ条件の過去検証とデータ品質を必ず通します。",
    caution: "本物の手法は非公開なので、ここでは考え方だけを安全に取り入れます。"
  };
}

function oneilMinerviniPlaybook({ asset, features, candles }) {
  const trend = trendAlignment(features, candles);
  const compression = recentCompression(candles);
  const channel = previousChannel(candles, 20);
  const isStockLike = ["米国株", "日本株", "指数ETF", "貴金属ETF・鉱山株"].includes(asset.group);
  const nearBreakout = channel ? features.close >= channel.high * 0.985 : false;
  const trendScore = trend.up ? 28 : 0;
  const volumeScore = features.volumeRatio >= 1.2 ? 14 : features.volumeRatio >= 1 ? 7 : 0;
  const breakoutScore = nearBreakout ? 18 : 0;
  const stockPenalty = isStockLike ? 0 : 16;
  const score = clamp(42 + trendScore + volumeScore + breakoutScore + compression.score * 0.18 - stockPenalty);

  return {
    trader: "William O'Neil / Mark Minervini",
    method: "強い銘柄が小さく固まり、出来高を伴って上へ出る形を見る",
    score: Math.round(score),
    signal: score >= 74 ? "上抜け候補" : isStockLike ? "形待ち" : "株式向け参考",
    fit: alignmentLabel(score),
    detail: `${compression.detail} 出来高は平均の${round(features.volumeRatio, 2)}倍です。`,
    howToUse: "株やETFでは、上向きの平均線、値幅の縮小、上限突破、出来高増加をまとめて見ます。",
    caution: "FXや貴金属では銘柄成長の考え方が弱いため、補助材料として扱います。"
  };
}

export function buildLegendTraderPlaybooks(context) {
  const cards = [
    turtlePlaybook(context),
    seykotaPlaybook(context),
    tudorJonesPlaybook(context),
    druckenmillerPlaybook(context),
    simonsPlaybook(context),
    oneilMinerviniPlaybook(context)
  ];
  const score = Math.round(average(cards.map((card) => card.score)) ?? 0);
  const strongest = [...cards].sort((a, b) => b.score - a.score).slice(0, 2);

  return {
    score,
    verdict: alignmentLabel(score),
    summary: `6つの巨匠手法で確認しました。最も合うのは「${strongest.map((card) => card.trader).join("」「")}」です。総合一致は${score}/100です。`,
    cards,
    notes: [
      "過去の名トレーダーの考え方を、現在の価格、出来高、検証結果、市場連動に変換して点数化しています。",
      "直接まねるのではなく、今のシグナルに足りない確認項目を見つけるために使います。",
      "実売買の指示ではありません。売買判断と投稿はユーザーが行います。"
    ],
    sources: [
      { name: "Turtle Traders", url: "https://www.turtletrader.com/rules/" },
      { name: "Ed Seykota", url: "https://en.wikipedia.org/wiki/Ed_Seykota" },
      { name: "Paul Tudor Jones", url: "https://en.wikipedia.org/wiki/Paul_Tudor_Jones" },
      { name: "Stanley Druckenmiller", url: "https://en.wikipedia.org/wiki/Stanley_Druckenmiller" },
      { name: "Jim Simons", url: "https://en.wikipedia.org/wiki/Jim_Simons" },
      { name: "CAN SLIM", url: "https://www.investors.com/ibd-university/can-slim/" },
      { name: "Mark Minervini", url: "https://www.businessinsider.com/stock-trader-shares-easy-chart-pattern-he-trades-2024-8" }
    ]
  };
}
