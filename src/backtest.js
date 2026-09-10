import { CANDIDATES } from "./candidates.js";
import { classifyMarketRegime, modelFitBonus } from "./marketRegime.js";

function maxDrawdown(equityCurve) {
  let peak = equityCurve[0] || 0;
  let worst = 0;
  for (const value of equityCurve) {
    peak = Math.max(peak, value);
    worst = Math.min(worst, value - peak);
  }
  return Math.abs(worst);
}

function maxLossStreak(returns) {
  let current = 0;
  let worst = 0;
  for (const value of returns) {
    if (value <= 0) {
      current += 1;
      worst = Math.max(worst, current);
    } else {
      current = 0;
    }
  }
  return worst;
}

function simulateTrade(signal, futureCandles, costRate) {
  if (signal.direction === "見送り" || futureCandles.length === 0) return null;
  const entry = signal.entryPrice;
  const stop = signal.stopLoss;
  const target = signal.takeProfit;
  let exit = futureCandles.at(-1).close;

  for (const candle of futureCandles) {
    if (signal.direction === "買い") {
      if (candle.low <= stop) {
        exit = stop;
        break;
      }
      if (candle.high >= target) {
        exit = target;
        break;
      }
    } else {
      if (candle.high >= stop) {
        exit = stop;
        break;
      }
      if (candle.low <= target) {
        exit = target;
        break;
      }
    }
  }

  const rawReturn = signal.direction === "買い" ? (exit - entry) / entry : (entry - exit) / entry;
  return rawReturn - costRate;
}

export function backtestCandidate(candles, candidate, options = {}) {
  const minHistory = options.minHistory ?? 80;
  const horizon = options.horizon ?? 8;
  const costRate = options.costRate ?? 0.0006;
  const returns = [];
  const equityCurve = [0];

  for (let index = minHistory; index < candles.length - horizon; index += horizon) {
    const history = candles.slice(0, index);
    const future = candles.slice(index, index + horizon);
    const signal = candidate(history);
    const tradeReturn = simulateTrade(signal, future, costRate);
    if (tradeReturn !== null && Number.isFinite(tradeReturn)) {
      returns.push(tradeReturn);
      equityCurve.push(equityCurve.at(-1) + tradeReturn);
    }
  }

  const wins = returns.filter((value) => value > 0);
  const losses = returns.filter((value) => value <= 0);
  const grossWin = wins.reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(losses.reduce((sum, value) => sum + value, 0));
  const averageWin = wins.length ? grossWin / wins.length : 0;
  const averageLoss = losses.length ? grossLoss / losses.length : 0;
  const netReturn = returns.reduce((sum, value) => sum + value, 0);
  const drawdown = maxDrawdown(equityCurve);
  const winRate = returns.length ? wins.length / returns.length : 0;
  const averageReturn = returns.length ? netReturn / returns.length : 0;
  const profitFactor = grossLoss === 0 ? (grossWin > 0 ? 9.99 : 0) : grossWin / grossLoss;
  const payoffRatio = averageLoss === 0 ? (averageWin > 0 ? 9.99 : 0) : averageWin / averageLoss;
  const lossStreak = maxLossStreak(returns);
  const sampleScore = Math.min(1, returns.length / 10);
  const stabilityPenalty = drawdown * 100 + Math.max(0, lossStreak - 2) * 1.5;
  const expectancyScore = averageReturn * 10000;

  return {
    trades: returns.length,
    winRate,
    profitFactor,
    payoffRatio,
    expectancy: averageReturn,
    averageReturn,
    netReturn,
    maxDrawdown: drawdown,
    maxLossStreak: lossStreak,
    sampleScore,
    score: expectancyScore * 0.45 + netReturn * 80 + winRate * 24 + profitFactor * 3 + payoffRatio * 2 + sampleScore * 8 - stabilityPenalty
  };
}

export function runModelTournament(candles, options = {}) {
  const regime = classifyMarketRegime(candles);
  return CANDIDATES.map((candidate) => {
    const currentSignal = candidate(candles);
    const metrics = backtestCandidate(candles, candidate, options);
    const fitBonus = modelFitBonus(currentSignal.name, regime);
    const samplePenalty = metrics.trades < 3 ? -10 : 0;
    return {
      name: currentSignal.name,
      currentSignal,
      metrics,
      regimeFit: fitBonus,
      adjustedScore: metrics.score + fitBonus + samplePenalty
    };
  }).sort((a, b) => b.adjustedScore - a.adjustedScore);
}
