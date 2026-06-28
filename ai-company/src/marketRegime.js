import { latestFeatures, round } from "./indicators.js";

function directionFromSlope(slope) {
  if (slope > 0) return "上向き";
  if (slope < 0) return "下向き";
  return "横ばい";
}

export function classifyMarketRegime(candles) {
  const features = latestFeatures(candles);
  const atrPercent = features.atr14 && features.close ? features.atr14 / features.close : 0;
  const trendStrength = features.sma20 && features.sma50 && features.atr14
    ? Math.abs(features.sma20 - features.sma50) / Math.max(features.atr14, features.close * 0.0001)
    : 0;
  const slopePercent = features.slope24 && features.close ? features.slope24 / features.close : 0;
  const rangeWidthPercent = features.support && features.resistance && features.close
    ? (features.resistance - features.support) / features.close
    : 0;
  const direction = directionFromSlope(slopePercent);
  const reasons = [];
  let name = "中立";
  let riskLevel = "通常";
  let preferredModels = ["Indicator Composite", "Time Series Momentum"];

  if (atrPercent >= 0.018) {
    name = "荒い値動き";
    riskLevel = "高い";
    preferredModels = ["Indicator Composite", "Time Series Momentum"];
    reasons.push(`値動きの荒さが価格の${round(atrPercent * 100, 2)}%あり、通常より大きいです。`);
  } else if (trendStrength >= 1.1 && Math.abs(slopePercent) >= 0.00025) {
    name = direction === "下向き" ? "下降トレンド" : "上昇トレンド";
    preferredModels = ["Trend Breakout", "Time Series Momentum"];
    reasons.push(`短期平均と中期平均の差が値動きの荒さの${round(trendStrength, 2)}倍あります。`);
  } else if (rangeWidthPercent > 0 && rangeWidthPercent <= Math.max(atrPercent * 7, 0.006)) {
    name = "レンジ";
    preferredModels = ["Range Reversion", "Indicator Composite"];
    reasons.push(`直近の上限と下限の幅が価格の${round(rangeWidthPercent * 100, 2)}%に収まっています。`);
  } else {
    reasons.push("トレンドとレンジのどちらにも強く寄っていない状態です。");
  }

  if (features.volumeRatio < 0.65) {
    riskLevel = "高い";
    reasons.push(`出来高が平均の${round(features.volumeRatio, 2)}倍で、参加者が少ない可能性があります。`);
  } else if (features.volumeRatio > 1.25) {
    reasons.push(`出来高が平均の${round(features.volumeRatio, 2)}倍で、動きに参加者が増えています。`);
  }

  if (reasons.length < 2) {
    reasons.push(`直近の傾きは${direction}です。`);
  }

  return {
    name,
    direction,
    riskLevel,
    atrPercent: round(atrPercent * 100, 2),
    trendStrength: round(trendStrength, 2),
    rangeWidthPercent: round(rangeWidthPercent * 100, 2),
    volumeRatio: round(features.volumeRatio, 2),
    preferredModels,
    reasons: reasons.slice(0, 4)
  };
}

export function modelFitBonus(modelName, regime) {
  if (regime.preferredModels.includes(modelName)) return 8;
  if (regime.name.includes("トレンド") && modelName === "Range Reversion") return -8;
  if (regime.name === "レンジ" && modelName === "Trend Breakout") return -6;
  if (regime.name === "荒い値動き" && modelName === "Range Reversion") return -4;
  return 0;
}
