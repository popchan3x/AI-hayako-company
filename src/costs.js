import { round } from "./indicators.js";

const GROUP_COSTS = {
  FX: { spreadBps: 1.2, slippageBps: 0.8, feeBps: 0.2 },
  "貴金属": { spreadBps: 3.5, slippageBps: 1.5, feeBps: 0.3 },
  "貴金属ETF・鉱山株": { spreadBps: 2.8, slippageBps: 1.4, feeBps: 0.4 },
  "指数ETF": { spreadBps: 1.8, slippageBps: 0.9, feeBps: 0.3 },
  "米国株": { spreadBps: 2.2, slippageBps: 1.2, feeBps: 0.4 },
  "日本株": { spreadBps: 3.0, slippageBps: 1.8, feeBps: 0.5 }
};

export function estimateTradingCosts(asset, features) {
  const base = GROUP_COSTS[asset.group] || { spreadBps: 2, slippageBps: 1, feeBps: 0.4 };
  const volatilityBps = features.atr14 && features.close ? (features.atr14 / features.close) * 10000 : 0;
  const volatilityPenalty = volatilityBps > 120 ? 1.5 : volatilityBps > 70 ? 0.8 : 0;
  const liquidityPenalty = features.volumeRatio < 0.7 ? 1.2 : 0;
  const totalBps = base.spreadBps + base.slippageBps + base.feeBps + volatilityPenalty + liquidityPenalty;

  return {
    spreadBps: round(base.spreadBps, 2),
    slippageBps: round(base.slippageBps + volatilityPenalty + liquidityPenalty, 2),
    feeBps: round(base.feeBps, 2),
    totalBps: round(totalBps, 2),
    costRate: totalBps / 10000,
    note: "スプレッド、ずれ、手数料を合計した検証用の概算です。"
  };
}
