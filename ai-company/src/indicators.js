export function round(value, decimals = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

export function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let current = sma(values.slice(0, period), period);
  for (const value of values.slice(period)) {
    current = value * k + current * (1 - k);
  }
  return current;
}

export function stdev(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mean = slice.reduce((sum, value) => sum + value, 0) / period;
  const variance = slice.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
  return Math.sqrt(variance);
}

export function rsi(values, period = 14) {
  if (values.length <= period) return null;
  const changes = [];
  for (let i = values.length - period; i < values.length; i += 1) {
    changes.push(values[i] - values[i - 1]);
  }
  const gains = changes.filter((value) => value > 0).reduce((sum, value) => sum + value, 0) / period;
  const losses = Math.abs(changes.filter((value) => value < 0).reduce((sum, value) => sum + value, 0) / period);
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function atr(candles, period = 14) {
  if (candles.length <= period) return null;
  const ranges = [];
  for (let i = candles.length - period; i < candles.length; i += 1) {
    const current = candles[i];
    const previous = candles[i - 1];
    ranges.push(Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    ));
  }
  return ranges.reduce((sum, value) => sum + value, 0) / period;
}

export function bollinger(values, period = 20, width = 2) {
  const middle = sma(values, period);
  const deviation = stdev(values, period);
  if (middle === null || deviation === null) return null;
  return {
    lower: middle - deviation * width,
    middle,
    upper: middle + deviation * width
  };
}

export function supportResistance(candles, period = 48) {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  return {
    support: Math.min(...slice.map((candle) => candle.low)),
    resistance: Math.max(...slice.map((candle) => candle.high))
  };
}

export function linearSlope(values, period = 24) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const n = slice.length;
  const xMean = (n - 1) / 2;
  const yMean = slice.reduce((sum, value) => sum + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (slice[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  return denominator === 0 ? 0 : numerator / denominator;
}

export function latestFeatures(candles) {
  const closes = candles.map((candle) => candle.close);
  const volumes = candles.map((candle) => candle.volume || 0);
  const last = candles.at(-1);
  const averageVolume = sma(volumes, Math.min(20, volumes.length)) || 0;
  const bands = bollinger(closes);
  const levels = supportResistance(candles);
  return {
    last,
    close: last.close,
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    ema12: ema(closes, 12),
    ema26: ema(closes, 26),
    rsi14: rsi(closes, 14),
    atr14: atr(candles, 14),
    bollinger: bands,
    support: levels?.support ?? null,
    resistance: levels?.resistance ?? null,
    slope24: linearSlope(closes, 24),
    averageVolume,
    volumeRatio: averageVolume > 0 ? last.volume / averageVolume : 1
  };
}
