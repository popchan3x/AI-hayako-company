import { latestFeatures, round } from "./indicators.js";
import { buildPricePlan } from "./pricing.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cleanRationale(rationale, features) {
  const items = rationale.filter(Boolean);
  if (features.atr14) {
    items.push(`値動きの荒さは現在価格の${round((features.atr14 / features.close) * 100, 2)}%です。`);
  }
  if (features.support && features.resistance) {
    items.push(`近い下限は${round(features.support)}、近い上限は${round(features.resistance)}です。`);
  }
  items.push(`出来高は平均の${round(features.volumeRatio, 2)}倍です。`);
  return [...new Set(items)].slice(0, 5);
}

function candidateResult(name, direction, confidence, features, rationale, profile) {
  return {
    name,
    direction,
    confidence: clamp(Math.round(confidence), 0, 100),
    ...buildPricePlan(direction, features),
    rationale: cleanRationale(rationale, features),
    profile
  };
}

export function trendBreakoutCandidate(candles) {
  const features = latestFeatures(candles);
  const rationale = [];
  let score = 0;

  if (features.sma20 && features.sma50 && features.sma20 > features.sma50) {
    score += 2;
    rationale.push("短期平均が中期平均を上回り、上向きの流れが出ています。");
  }
  if (features.sma20 && features.sma50 && features.sma20 < features.sma50) {
    score -= 2;
    rationale.push("短期平均が中期平均を下回り、下向きの流れが出ています。");
  }
  if (features.resistance && features.close > features.resistance * 0.995) {
    score += 1.5;
    rationale.push("価格が直近の上限に近く、上抜けを試す位置です。");
  }
  if (features.support && features.close < features.support * 1.005) {
    score -= 1.5;
    rationale.push("価格が直近の下限に近く、下抜けに注意する位置です。");
  }
  if (features.slope24 !== null) {
    score += Math.sign(features.slope24) * 0.8;
    rationale.push(`直近24本の傾きは${features.slope24 >= 0 ? "上向き" : "下向き"}です。`);
  }
  if (features.volumeRatio > 1.25) {
    score += Math.sign(score || 1) * 0.5;
    rationale.push("出来高が増え、動きに参加者が増えています。");
  }

  const direction = score >= 2 ? "買い" : score <= -2 ? "売り" : "見送り";
  return candidateResult("Trend Breakout", direction, 45 + Math.abs(score) * 11, features, rationale, "流れが出ている相場向け");
}

export function indicatorCompositeCandidate(candles) {
  const features = latestFeatures(candles);
  const rationale = [];
  let score = 0;

  if (features.ema12 && features.ema26) {
    if (features.ema12 > features.ema26) {
      score += 1;
      rationale.push("短い平均が長い平均より上にあり、買いの勢いがあります。");
    } else {
      score -= 1;
      rationale.push("短い平均が長い平均より下にあり、売りの勢いがあります。");
    }
  }
  if (features.rsi14 !== null) {
    if (features.rsi14 > 62) {
      score += 0.9;
      rationale.push(`勢いの指数は${round(features.rsi14, 1)}で、上向きの力が強めです。`);
    } else if (features.rsi14 < 38) {
      score -= 0.9;
      rationale.push(`勢いの指数は${round(features.rsi14, 1)}で、下向きの力が強めです。`);
    } else {
      rationale.push(`勢いの指数は${round(features.rsi14, 1)}で、極端な偏りはありません。`);
    }
  }
  if (features.bollinger) {
    if (features.close > features.bollinger.upper) {
      score += 0.8;
      rationale.push("価格が上側の帯を超え、強い上振れが出ています。");
    } else if (features.close < features.bollinger.lower) {
      score -= 0.8;
      rationale.push("価格が下側の帯を下回り、強い下振れが出ています。");
    }
  }
  if (features.slope24 !== null) {
    score += Math.sign(features.slope24) * 0.7;
    rationale.push(`直近24本の価格の傾きは${features.slope24 >= 0 ? "上向き" : "下向き"}です。`);
  }

  const direction = score >= 1.8 ? "買い" : score <= -1.8 ? "売り" : "見送り";
  return candidateResult("Indicator Composite", direction, 42 + Math.abs(score) * 14, features, rationale, "複数の指標を合わせて見る基本モデル");
}

export function timeSeriesMomentumCandidate(candles) {
  const features = latestFeatures(candles);
  const rationale = [];
  const slope = features.slope24 || 0;
  const normalizedSlope = slope / Math.max(features.close, 0.0001);
  const projectedMove = normalizedSlope * 12;
  let direction = "見送り";

  if (projectedMove > 0.003) direction = "買い";
  if (projectedMove < -0.003) direction = "売り";

  rationale.push(`直近24本の価格変化から、次の短期方向は${projectedMove >= 0 ? "上向き" : "下向き"}です。`);
  rationale.push(`12本先まで同じ傾きが続く場合の変化見込みは${round(projectedMove * 100, 2)}%です。`);
  if (features.volumeRatio > 1.1) {
    rationale.push("出来高が平均より多く、短期の流れが続く可能性があります。");
  }

  return candidateResult("Time Series Momentum", direction, 40 + Math.abs(projectedMove) * 4800, features, rationale, "短期の勢いを見るモデル");
}

export function rangeReversionCandidate(candles) {
  const features = latestFeatures(candles);
  const rationale = [];
  let score = 0;

  if (features.bollinger && features.rsi14 !== null) {
    if (features.close <= features.bollinger.lower * 1.01 && features.rsi14 < 42) {
      score += 2.2;
      rationale.push("価格が下側の帯に近く、売られすぎからの反発を見ます。");
    }
    if (features.close >= features.bollinger.upper * 0.99 && features.rsi14 > 58) {
      score -= 2.2;
      rationale.push("価格が上側の帯に近く、買われすぎからの反落を見ます。");
    }
  }
  if (features.support && features.close <= features.support * 1.012) {
    score += 1;
    rationale.push("価格が近い下限にあり、反発候補の位置です。");
  }
  if (features.resistance && features.close >= features.resistance * 0.988) {
    score -= 1;
    rationale.push("価格が近い上限にあり、反落候補の位置です。");
  }
  if (features.slope24 !== null && Math.abs(features.slope24 / features.close) < 0.0002) {
    rationale.push("直近の傾きが小さく、行きすぎの戻りを見やすい状態です。");
  }

  const direction = score >= 1.8 ? "買い" : score <= -1.8 ? "売り" : "見送り";
  return candidateResult("Range Reversion", direction, 40 + Math.abs(score) * 13, features, rationale, "横ばい相場の反発と反落を見るモデル");
}

export function volatilitySqueezeCandidate(candles) {
  const features = latestFeatures(candles);
  const rationale = [];
  let score = 0;

  if (features.bollinger) {
    const bandWidth = (features.bollinger.upper - features.bollinger.lower) / features.close;
    if (bandWidth < 0.035) {
      score += Math.sign(features.slope24 || 0) * 1.2;
      rationale.push(`値動きの帯が価格の${round(bandWidth * 100, 2)}%に縮んでいます。`);
    } else {
      rationale.push(`値動きの帯は価格の${round(bandWidth * 100, 2)}%で、強い圧縮ではありません。`);
    }
    if (features.close > features.bollinger.upper * 0.997) {
      score += 1.4;
      rationale.push("価格が上側の帯に近く、上方向への動き出しを見ます。");
    }
    if (features.close < features.bollinger.lower * 1.003) {
      score -= 1.4;
      rationale.push("価格が下側の帯に近く、下方向への動き出しを見ます。");
    }
  }
  if (features.volumeRatio > 1.15) {
    score += Math.sign(score || features.slope24 || 1) * 0.8;
    rationale.push("出来高が平均を上回り、圧縮後の動き出しに注意します。");
  }

  const direction = score >= 1.8 ? "買い" : score <= -1.8 ? "売り" : "見送り";
  return candidateResult("Volatility Squeeze", direction, 38 + Math.abs(score) * 15, features, rationale, "動きが小さくなった後の急な動き出しを見るモデル");
}

export const CANDIDATES = [
  trendBreakoutCandidate,
  indicatorCompositeCandidate,
  timeSeriesMomentumCandidate,
  rangeReversionCandidate,
  volatilitySqueezeCandidate
];
