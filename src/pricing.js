import { round } from "./indicators.js";

export function buildPricePlan(direction, features) {
  const entry = features.close;
  const atr = features.atr14 || entry * 0.01;
  const support = features.support ?? entry - atr * 2;
  const resistance = features.resistance ?? entry + atr * 2;

  if (direction === "買い") {
    const stop = Math.min(entry - atr * 1.2, support - atr * 0.2);
    const risk = Math.max(entry - stop, atr);
    return {
      entryPrice: round(entry, priceDecimals(entry)),
      stopLoss: round(stop, priceDecimals(entry)),
      takeProfit: round(entry + risk * 1.8, priceDecimals(entry)),
      riskReward: round(1.8, 2)
    };
  }

  if (direction === "売り") {
    const stop = Math.max(entry + atr * 1.2, resistance + atr * 0.2);
    const risk = Math.max(stop - entry, atr);
    return {
      entryPrice: round(entry, priceDecimals(entry)),
      stopLoss: round(stop, priceDecimals(entry)),
      takeProfit: round(entry - risk * 1.8, priceDecimals(entry)),
      riskReward: round(1.8, 2)
    };
  }

  return {
    entryPrice: round(entry, priceDecimals(entry)),
    stopLoss: round(entry - atr, priceDecimals(entry)),
    takeProfit: round(entry + atr, priceDecimals(entry)),
    riskReward: 0
  };
}

export function priceDecimals(price) {
  if (price < 2) return 5;
  if (price < 100) return 3;
  return 2;
}
