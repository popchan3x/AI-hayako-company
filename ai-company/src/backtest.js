import { CANDIDATES } from "./candidates.js";

function maxDrawdown(equityCurve) {
  let peak = equityCurve[0] || 0;
  let worst = 0;
  for (const value of equityCurve) {
    peak = Math.max(peak, value);
    worst = Math.min(worst, value - peak);
  }
  return Math.abs(worst);
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
  const netReturn = returns.reduce((sum, value) => sum + value, 0);

  return {
    trades: returns.length,
    winRate: returns.length ? wins.length / returns.length : 0,
    profitFactor: grossLoss === 0 ? (grossWin > 0 ? 9.99 : 0) : grossWin / grossLoss,
    netReturn,
    maxDrawdown: maxDrawdown(equityCurve),
    score: netReturn * 100 + (returns.length ? wins.length / returns.length : 0) * 35 - maxDrawdown(equityCurve) * 100
  };
}

export function runModelTournament(candles) {
  return CANDIDATES.map((candidate) => {
    const currentSignal = candidate(candles);
    const metrics = backtestCandidate(candles, candidate);
    return {
      name: currentSignal.name,
      currentSignal,
      metrics
    };
  }).sort((a, b) => b.metrics.score - a.metrics.score);
}
