import { fetchStooqCandles, fetchYahooCandles } from "../src/dataProvider.js";
import { assessDataQuality } from "../src/dataQuality.js";
import { findAsset } from "../src/assets.js";

const symbols = [
  "AUDCAD",
  "AUDCHF",
  "AUDJPY",
  "AUDUSD",
  "CADCHF",
  "CADJPY",
  "CHFJPY",
  "EURAUD",
  "EURCAD",
  "EURCHF",
  "EURGBP",
  "EURJPY",
  "EURUSD",
  "GBPAUD",
  "GBPCAD",
  "GBPCHF",
  "GBPJPY",
  "GBPUSD",
  "USDCAD",
  "USDCHF",
  "USDJPY"
];

async function check(symbol, provider) {
  const asset = findAsset(symbol);
  const startedAt = Date.now();
  const result = provider === "free-yahoo"
    ? await fetchYahooCandles(symbol, { interval: "1d", timeoutMs: 9000 })
    : await fetchStooqCandles(symbol, { interval: "1d", timeoutMs: 9000 });
  const quality = assessDataQuality(result.candles, result.source, {
    interval: "1d",
    assetGroup: asset?.group,
    requiredBars: 90
  });

  return {
    symbol,
    provider,
    source: result.source,
    dataSymbol: result.dataSymbol || asset?.dataSymbol || null,
    bars: result.candles.length,
    usable: quality.usable,
    score: quality.score,
    staleHours: quality.staleHours,
    lastTime: result.candles.at(-1)?.time || null,
    invalidBars: quality.invalidBars,
    gaps: quality.gapCount,
    zeroVolumeBars: quality.zeroVolumeBars,
    warning: result.warning,
    ms: Date.now() - startedAt
  };
}

const rows = [];
for (const symbol of symbols) {
  for (const provider of ["free-stooq", "free-yahoo"]) {
    rows.push(await check(symbol, provider));
    console.error(`${symbol} ${provider} done`);
  }
}

const byProvider = Object.fromEntries(["free-stooq", "free-yahoo"].map((provider) => {
  const list = rows.filter((row) => row.provider === provider);
  return [provider, {
    checked: list.length,
    usable: list.filter((row) => row.usable).length,
    zeroBars: list.filter((row) => row.bars === 0).length,
    avgScore: Math.round(list.reduce((sum, row) => sum + row.score, 0) / list.length),
    avgMs: Math.round(list.reduce((sum, row) => sum + row.ms, 0) / list.length)
  }];
}));

const summary = {
  checkedAt: new Date().toISOString(),
  symbols,
  rows,
  byProvider,
  bySymbol: Object.fromEntries(symbols.map((symbol) => [
    symbol,
    rows
      .filter((row) => row.symbol === symbol)
      .map(({ provider, bars, usable, score, staleHours, lastTime, warning }) => ({
        provider,
        bars,
        usable,
        score,
        staleHours,
        lastTime,
        warning
      }))
  ]))
};

console.log(JSON.stringify(summary, null, 2));
