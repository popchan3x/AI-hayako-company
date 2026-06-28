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

function fetchWithTimeout(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 7000);
  return fetchImpl(url, {
    signal: controller.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 HayakoMarketAI/0.1",
      ...options.headers
    }
  }).finally(() => clearTimeout(timeout));
}

export function resolveYahooSymbol(asset) {
  if (!asset) return null;
  if (asset.group === "FX") return `${asset.symbol}=X`;
  if (asset.symbol === "XAUUSD") return "GC=F";
  if (asset.symbol === "XAGUSD") return "SI=F";
  if (asset.symbol === "XPTUSD") return "PL=F";
  if (asset.symbol === "XPDUSD") return "PA=F";
  if (asset.dataSymbol.endsWith(".jp")) return `${asset.dataSymbol.split(".")[0]}.T`;
  if (asset.dataSymbol.endsWith(".us")) return asset.dataSymbol.split(".")[0].toUpperCase();
  return asset.symbol;
}

function parseYahooChart(payload) {
  const result = payload?.chart?.result?.[0];
  const timestamps = result?.timestamp || [];
  const quote = result?.indicators?.quote?.[0] || {};
  return timestamps.map((timestamp, index) => ({
    time: new Date(timestamp * 1000).toISOString(),
    open: Number(quote.open?.[index]),
    high: Number(quote.high?.[index]),
    low: Number(quote.low?.[index]),
    close: Number(quote.close?.[index]),
    volume: Number(quote.volume?.[index]) || 0
  })).filter((candle) => (
    Number.isFinite(candle.open)
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low)
    && Number.isFinite(candle.close)
    && candle.close > 0
  ));
}

export async function fetchStooqCandles(symbol, options = {}) {
  const asset = findAsset(symbol);
  if (!asset) return { candles: [], source: "free-stooq", warning: "対象が未登録です。" };
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(asset.dataSymbol)}&i=d`;
  try {
    const response = await fetchWithTimeout(url, options);
    if (!response.ok) {
      return { candles: [], source: "free-stooq", warning: `Stooqの取得に失敗しました。HTTP ${response.status}` };
    }
    const candles = parseCsv(await response.text());
    return {
      candles,
      source: "free-stooq",
      warning: candles.length === 0 ? "Stooqの無料データが空でした。" : "Stooqの無料データは遅延や欠損の可能性があります。"
    };
  } catch (error) {
    return { candles: [], source: "free-stooq", warning: `Stooqの取得に失敗しました: ${error.message}` };
  }
}

export async function fetchYahooCandles(symbol, options = {}) {
  const asset = findAsset(symbol);
  if (!asset) return { candles: [], source: "free-yahoo", warning: "対象が未登録です。" };
  const yahooSymbol = resolveYahooSymbol(asset);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d&includePrePost=false`;
  try {
    const response = await fetchWithTimeout(url, options);
    if (!response.ok) {
      return { candles: [], source: "free-yahoo", warning: `Yahooの取得に失敗しました。HTTP ${response.status}` };
    }
    const payload = await response.json();
    const error = payload?.chart?.error;
    if (error) {
      return { candles: [], source: "free-yahoo", warning: `Yahooの取得に失敗しました: ${error.description || error.code}` };
    }
    const candles = parseYahooChart(payload);
    return {
      candles,
      source: "free-yahoo",
      dataSymbol: yahooSymbol,
      warning: candles.length === 0 ? "Yahooの無料データが空でした。" : "Yahooの無料データは遅延や欠損の可能性があります。"
    };
  } catch (error) {
    return { candles: [], source: "free-yahoo", warning: `Yahooの取得に失敗しました: ${error.message}` };
  }
}

export async function fetchFreeCandles(symbol, options = {}) {
  const stooq = await fetchStooqCandles(symbol, options);
  if (stooq.candles.length > 0) {
    return {
      ...stooq,
      source: "free-composite:free-stooq",
      warning: `Stooqを採用しました。${stooq.warning}`
    };
  }

  const yahoo = await fetchYahooCandles(symbol, options);
  if (yahoo.candles.length > 0) {
    return {
      ...yahoo,
      source: "free-composite:free-yahoo",
      warning: `Stooqは未採用です。Yahooを採用しました。${yahoo.warning}`
    };
  }

  return {
    candles: [],
    source: "free-composite",
    warning: `無料データ取得に失敗しました。Stooq: ${stooq.warning} / Yahoo: ${yahoo.warning}`
  };
}

export async function getCandles({ symbol, provider = "demo" }) {
  if (provider === "free-stooq") return fetchStooqCandles(symbol);
  if (provider === "free-yahoo") return fetchYahooCandles(symbol);
  if (provider === "free-composite" || provider === "free") return fetchFreeCandles(symbol);
  return {
    candles: generateDemoCandles(symbol),
    source: "demo",
    warning: "デモデータです。実売買には使わず、検証用として扱ってください。"
  };
}
