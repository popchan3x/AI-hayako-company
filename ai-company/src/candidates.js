import { latestFeatures, round } from "./indicators.js";
import { buildPricePlan } from "./pricing.js";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function candidateResult(name, direction, confidence, features, rationale) {
  return {
    name,
    direction,
    confidence: clamp(Math.round(confidence), 0, 100),
    ...buildPricePlan(direction, features),
    rationale: rationale.slice(0, 5)
  };
}

export function trendBreakoutCandidate(candles) {
  const features = latestFeatures(candles);
  const rationale = [];
  let direction = "見送り";
  let score = 0;

  if (features.sma20 && features.sma50 && features.sma20 > features.sma50) {
    score += 2;
    rationale.push("短期平均が中期平均を上回り、上向きの流れです。");
  }
  if (features.sma20 && features.sma50 && features.sma20 < features.sma50) {
    score -= 2;
    rationale.push("短期平均が中期平均を下回り、下向きの流れです。");
  }
  if (features.resistance && features.close > features.resistance * 0.995) {
    score += 1.5;
    rationale.push("直近の上値に近く、上抜けを試す位置です。");
  }
  if (features.support && features.close < features.support * 1.005) {
    score -= 1.5;
    rationale.push("直近の下値に近く、下抜けに注意する位置です。");
  }
  if (features.volumeRatio > 1.25) {
    rationale.push(`出来高が平均の${round(features.volumeRatio, 2)}倍で、動きに参加者が増えています。`);
    score += Math.sign(score || 1) * 0.5;
  }

  if (score >= 2) direction = "買い";
  if (score <= -2) direction = "売り";
  const confidence = 45 + Math.abs(score) * 12;
  return candidateResult("Trend Breakout", direction, confidence, features, rationale);
}

export function indicatorCompositeCandidate(candles) {
  const features = latestFeatures(candles);
  const rationale = [];
  let score = 0;

  if (features.ema12 && features.ema26) {
    if (features.ema12 > features.ema26) {
      score += 1;
      rationale.push("短い指数平均が長い指数平均より上で、買いの勢いがあります。");
    } else {
      score -= 1;
      rationale.push("短い指数平均が長い指数平均より下で、売りの勢いがあります。");
    }
  }
  if (features.rsi14 !== null) {
    if (features.rsi14 > 62) {
      score += 1;
      rationale.push(`RSIは${round(features.rsi14, 1)}で、上方向の勢いが強めです。`);
    } else if (features.rsi14 < 38) {
      score -= 1;
      rationale.push(`RSIは${round(features.rsi14, 1)}で、下方向の勢いが強めです。`);
    } else {
      rationale.push(`RSIは${round(features.rsi14, 1)}で、極端な偏りはありません。`);
    }
  }
  if (features.bollinger) {
    if (features.close > features.bollinger.upper) {
      score += 1;
      rationale.push("価格が上側バンドを超え、強い上振れが出ています。");
    } else if (features.close < features.bollinger.lower) {
      score -= 1;
      rationale.push("価格が下側バンドを下回り、強い下振れが出ています。");
    }
  }
  if (features.slope24 !== null) {
    score += Math.sign(features.slope24) * 0.8;
    rationale.push(`直近24本の傾きは${features.slope24 >= 0 ? "上向き" : "下向き"}です。`);
  }

  const direction = score >= 1.8 ? "買い" : score <= -1.8 ? "売り" : "見送り";
  return candidateResult("Indicator Composite", direction, 42 + Math.abs(score) * 15, features, rationale);
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
  if (features.atr14) {
    rationale.push(`値動きの荒さは現在価格の${round((features.atr14 / features.close) * 100, 2)}%です。`);
  }
  if (features.support && features.resistance) {
    rationale.push(`近い下値は${round(features.support)}、近い上値は${round(features.resistance)}です。`);
  }

  return candidateResult("Time Series Momentum", direction, 40 + Math.abs(projectedMove) * 5000, features, rationale);
}

export const CANDIDATES = [
  trendBreakoutCandidate,
  indicatorCompositeCandidate,
  timeSeriesMomentumCandidate
];
