import { findAsset } from "./assets.js";

function hashSeed(text) {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) / 4294967296);
  };
}

export function generateDemoCandles(symbol, count = 220) {
  const asset = findAsset(symbol);
  if (!asset) return [];
  const random = seededRandom(hashSeed(asset.symbol));
  const candles = [];
  let price = asset.basePrice;
  const now = Date.now();
  const intervalMs = 15 * 60 * 1000;
  const volatility = asset.group === "FX" ? 0.0018 : asset.group === "貴金属" ? 0.004 : 0.003;

  for (let index = count - 1; index >= 0; index -= 1) {
    const wave = Math.sin((count - index) / 13) * volatility * 0.8;
    const drift = (random() - 0.48) * volatility + wave;
    const open = price;
    const close = Math.max(0.0001, open * (1 + drift));
    const range = Math.max(Math.abs(close - open), open * volatility * (0.6 + random()));
    const high = Math.max(open, close) + range * (0.25 + random() * 0.45);
    const low = Math.max(0.0001, Math.min(open, close) - range * (0.25 + random() * 0.45));
    const volume = Math.round(100000 + random() * 900000 + Math.abs(drift) * 100000000);
    candles.push({
      time: new Date(now - index * intervalMs).toISOString(),
      open,
      high,
      low,
      close,
      volume
    });
    price = close;
  }
  return candles;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const [date, open, high, low, close, volume] = line.split(",");
    return {
      time: `${date}T00:00:00.000Z`,
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume) || 0
    };
  }).filter((candle) => Number.isFinite(candle.close));
}

export async function fetchFreeCandles(symbol) {
  const asset = findAsset(symbol);
  if (!asset) return { candles: [], source: "free-stooq", warning: "対象が未登録です。" };
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(asset.dataSymbol)}&i=d`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return { candles: [], source: "free-stooq", warning: `無料データ取得に失敗しました。HTTP ${response.status}` };
    }
    const candles = parseCsv(await response.text());
    return {
      candles,
      source: "free-stooq",
      warning: candles.length === 0 ? "無料データが空でした。" : "無料データは遅延や欠損の可能性があります。"
    };
  } catch (error) {
    return { candles: [], source: "free-stooq", warning: `無料データ取得に失敗しました: ${error.message}` };
  } finally {
    clearTimeout(timeout);
  }
}

export async function getCandles({ symbol, provider = "demo" }) {
  if (provider === "free-stooq") {
    return fetchFreeCandles(symbol);
  }
  return {
    candles: generateDemoCandles(symbol),
    source: "demo",
    warning: "デモデータです。実売買には使わず、検証用として扱ってください。"
  };
}

