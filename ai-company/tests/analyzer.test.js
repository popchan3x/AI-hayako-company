import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSymbol, listAssets, researchRoadmap } from "../src/analyzer.js";
import { backtestCandidate, runModelTournament } from "../src/backtest.js";
import { trendBreakoutCandidate } from "../src/candidates.js";
import { fetchFreeCandles, fetchYahooCandles, generateDemoCandles, resolveYahooSymbol } from "../src/dataProvider.js";
import { runDailyLearning } from "../src/learning.js";
import { auditUniverse, classifyDataStatus, UNIVERSE_STATUS } from "../src/universeAudit.js";
import { assessDataQuality } from "../src/dataQuality.js";
import { buildCurrencyStrengthMap, buildImportantEventFilter } from "../src/marketGuards.js";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("asset universe includes expanded watchlist and excludes USB", () => {
  const symbols = listAssets().map((asset) => asset.symbol);
  const groups = listAssets().map((asset) => asset.group);
  assert.ok(symbols.includes("XAUUSD"));
  assert.ok(symbols.includes("XAGUSD"));
  assert.ok(symbols.includes("XPTUSD"));
  assert.ok(symbols.includes("XPDUSD"));
  assert.ok(symbols.includes("USDJPY"));
  assert.ok(symbols.includes("USDCAD"));
  assert.ok(symbols.includes("USDCHF"));
  assert.ok(symbols.includes("EURCHF"));
  assert.ok(symbols.includes("CHFJPY"));
  assert.ok(symbols.includes("NVDA"));
  assert.ok(symbols.includes("7203JP"));
  assert.ok(symbols.includes("1321JP"));
  assert.ok(symbols.includes("GDX"));
  assert.equal(symbols.includes("USB"), false);
  assert.equal(new Set(symbols).size, symbols.length);
  assert.equal(listAssets().filter((asset) => asset.group === "FX").length, 21);
  assert.ok(groups.includes("貴金属"));
  assert.ok(groups.includes("貴金属ETF・鉱山株"));
  assert.ok(groups.includes("日本株"));
  assert.ok(groups.includes("指数ETF"));
  assert.ok(listAssets().length >= 90);
});

test("analyzer returns priced validation signal with regime and meta model", async () => {
  const result = await analyzeSymbol("XAUUSD", { provider: "demo" });
  assert.equal(result.ok, true);
  assert.equal(result.signal.validationLabel, "検証用シグナル");
  assert.ok(["買い", "売り", "見送り"].includes(result.signal.direction));
  assert.equal(typeof result.signal.entryPrice, "number");
  assert.equal(typeof result.signal.stopLoss, "number");
  assert.equal(typeof result.signal.takeProfit, "number");
  assert.equal(typeof result.signal.selectedModel, "string");
  assert.equal(typeof result.signal.marketRegime.name, "string");
  assert.equal(typeof result.signal.modelAgreement, "number");
  assert.equal(typeof result.signal.dataQuality.score, "number");
  assert.equal(typeof result.signal.costs.totalBps, "number");
  assert.equal(typeof result.signal.voteWeights.buy, "number");
  assert.equal(typeof result.signal.marketLinkage.score, "number");
  assert.equal(typeof result.signal.marketLinkage.status, "string");
  assert.ok(result.signal.marketLinkage.drivers.some((driver) => typeof driver.impact === "string" && driver.impact.length > 0));
  assert.ok(result.signal.marketLinkage.drivers.some((driver) => typeof driver.moveMeaning === "string" && driver.moveMeaning.length > 0));
  assert.equal(typeof result.signal.eventFilter.score, "number");
  assert.equal(typeof result.signal.eventFilter.status, "string");
  assert.equal(typeof result.signal.dataQuality.decision, "string");
  assert.equal(typeof result.signal.intelligence.edgeScore, "number");
  assert.equal(result.signal.intelligence.autoTradeGate.canAutoTrade, false);
  assert.equal(result.signal.intelligence.sourceSafety.noExternalCodeExecuted, true);
  assert.ok(result.signal.intelligence.factors.length >= 11);
  assert.equal(typeof result.signal.legendPlaybooks.score, "number");
  assert.equal(result.signal.legendPlaybooks.cards.length, 6);
  assert.ok(result.signal.legendPlaybooks.cards.some((card) => card.trader.includes("Turtle")));
  assert.ok(result.signal.intelligence.factors.some((factor) => factor.name === "巨匠手法"));
  assert.ok(result.signal.intelligence.externalSignals.length >= 5);
  assert.ok(result.signal.scenarios.length >= 3);
  assert.ok(result.signal.riskSummary.length >= 4);
  assert.ok(result.signal.reasons.length >= 3);
  assert.ok(result.signal.reasons.length <= 5);
  assert.ok(result.signal.warnings.length >= 2);
  assert.match(result.signal.xDraft, /直接の売買推奨ではありません/);
  assert.equal(JSON.stringify(result).includes(String.fromCodePoint(0x7e3a)), false);
});

test("unknown asset is not guessed", async () => {
  const result = await analyzeSymbol("USB", { provider: "demo" });
  assert.equal(result.ok, false);
  assert.equal(result.status, "分析不可");
  assert.equal(result.signal, null);
});

test("free data providers map symbols and parse yahoo chart payload", async () => {
  const yahooPayload = {
    chart: {
      result: [{
        timestamp: [1767225600, 1767312000],
        indicators: {
          quote: [{
            open: [100, 101],
            high: [102, 103],
            low: [99, 100],
            close: [101, 102],
            volume: [1000, 1200]
          }]
        }
      }],
      error: null
    }
  };
  const fetchImpl = async () => new Response(JSON.stringify(yahooPayload), { status: 200 });
  const result = await fetchYahooCandles("7203JP", { fetchImpl });
  assert.equal(resolveYahooSymbol(listAssets().find((asset) => asset.symbol === "7203JP")), "7203.T");
  assert.equal(resolveYahooSymbol(listAssets().find((asset) => asset.symbol === "USDJPY")), "USDJPY=X");
  assert.equal(resolveYahooSymbol(listAssets().find((asset) => asset.symbol === "XAUUSD")), "GC=F");
  assert.equal(result.source, "free-yahoo");
  assert.equal(result.dataSymbol, "7203.T");
  assert.equal(result.candles.length, 2);
  assert.equal(result.candles[1].close, 102);
});

test("yahoo provider supports intraday timeframes and aggregates 4 hour candles", async () => {
  const timestamps = Array.from({ length: 8 }, (_, index) => 1767225600 + index * 3600);
  const yahooPayload = {
    chart: {
      result: [{
        timestamp: timestamps,
        indicators: {
          quote: [{
            open: [100, 101, 102, 103, 104, 105, 106, 107],
            high: [101, 102, 103, 104, 105, 106, 107, 108],
            low: [99, 100, 101, 102, 103, 104, 105, 106],
            close: [101, 102, 103, 104, 105, 106, 107, 108],
            volume: [10, 20, 30, 40, 50, 60, 70, 80]
          }]
        }
      }],
      error: null
    }
  };
  let requestedUrl = "";
  const fetchImpl = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify(yahooPayload), { status: 200 });
  };
  const result = await fetchYahooCandles("SPY", { fetchImpl, interval: "4h" });
  assert.match(requestedUrl, /interval=60m/);
  assert.match(requestedUrl, /range=6mo/);
  assert.equal(result.interval, "4h");
  assert.equal(result.candles.length, 2);
  assert.equal(result.candles[0].open, 100);
  assert.equal(result.candles[0].close, 104);
  assert.equal(result.candles[0].volume, 100);
});

test("composite free provider falls back from stooq to yahoo", async () => {
  const yahooPayload = {
    chart: {
      result: [{
        timestamp: [1767225600],
        indicators: {
          quote: [{
            open: [2500],
            high: [2520],
            low: [2490],
            close: [2510],
            volume: [2000]
          }]
        }
      }],
      error: null
    }
  };
  const fetchImpl = async (url) => {
    if (String(url).includes("stooq.com")) return new Response("", { status: 500 });
    return new Response(JSON.stringify(yahooPayload), { status: 200 });
  };
  const result = await fetchFreeCandles("XAUUSD", { fetchImpl });
  assert.equal(result.source, "free-composite:free-yahoo");
  assert.equal(result.dataSymbol, "GC=F");
  assert.equal(result.candles.length, 1);
});

test("yahoo provider can recover from node certificate failures with trusted fallback", async () => {
  const yahooPayload = {
    chart: {
      result: [{
        timestamp: [1767225600],
        indicators: {
          quote: [{
            open: [100],
            high: [102],
            low: [99],
            close: [101],
            volume: [900]
          }]
        }
      }],
      error: null
    }
  };
  const error = new TypeError("fetch failed");
  error.cause = { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE", message: "unable to verify the first certificate" };
  const result = await fetchYahooCandles("SPY", {
    fetchImpl: async () => { throw error; },
    fallbackFetchText: async () => JSON.stringify(yahooPayload)
  });
  assert.equal(result.candles.length, 1);
  assert.match(result.warning, /test-fallback/);
});

test("backtest produces finite walk-forward metrics", () => {
  const candles = generateDemoCandles("XAUUSD", 180);
  const metrics = backtestCandidate(candles, trendBreakoutCandidate);
  assert.equal(Number.isFinite(metrics.winRate), true);
  assert.equal(Number.isFinite(metrics.netReturn), true);
  assert.equal(Number.isFinite(metrics.maxDrawdown), true);
  assert.equal(Number.isFinite(metrics.averageReturn), true);
  assert.equal(Number.isFinite(metrics.expectancy), true);
  assert.equal(Number.isFinite(metrics.payoffRatio), true);
  assert.equal(typeof metrics.maxLossStreak, "number");
  assert.ok(metrics.trades >= 0);
});

test("model tournament ranks candidates with regime adjustment", () => {
  const candles = generateDemoCandles("XAUUSD", 220);
  const tournament = runModelTournament(candles);
  assert.ok(tournament.length >= 5);
  assert.equal(Number.isFinite(tournament[0].adjustedScore), true);
  assert.equal(typeof tournament[0].regimeFit, "number");
});

test("analyzer returns timeframe and visible analysis materials", async () => {
  const result = await analyzeSymbol("XAUUSD", { provider: "demo", interval: "5m" });
  assert.equal(result.ok, true);
  assert.equal(result.interval, "5m");
  assert.equal(result.timeframe.label, "5分");
  assert.ok(result.candles.length <= 180);
  assert.ok(result.analysisMaterials.cards.length >= 11);
  assert.ok(result.analysisMaterials.cards.some((card) => card.name === "巨匠手法"));
  assert.equal(result.analysisMaterials.legendPlaybooks.cards.length, 6);
  assert.ok(result.analysisMaterials.summary.length >= 4);
});

test("data quality score explains freshness, shape, and continuity", () => {
  const candles = generateDemoCandles("XAUUSD", 120, "5m");
  candles[20] = { ...candles[20], high: candles[20].low - 1 };
  candles[50] = { ...candles[50], close: candles[49].close * 1.25 };
  const quality = assessDataQuality(candles, "demo", { interval: "5m", requiredBars: 90 });
  assert.equal(quality.usable, false);
  assert.ok(quality.score < 90);
  assert.ok(quality.components.length >= 6);
  assert.ok(quality.issues.some((issue) => issue.includes("壊れている")));
});

test("important event filter warns inside recurring US data window", () => {
  const asset = listAssets().find((item) => item.symbol === "XAUUSD");
  const filter = buildImportantEventFilter(asset, { now: new Date("2026-06-29T12:30:00.000Z") });
  assert.equal(filter.status, "見送り優先");
  assert.ok(filter.score < 80);
  assert.ok(filter.activeEvents.some((event) => event.id === "us-data"));
  assert.ok(filter.warnings.length >= 1);
});

test("currency strength map ranks seven major currencies for FX", async () => {
  const result = await analyzeSymbol("USDJPY", { provider: "demo", interval: "1h" });
  assert.equal(result.ok, true);
  assert.equal(result.signal.currencyStrength.enabled, true);
  assert.equal(result.signal.currencyStrength.currencies.length, 7);
  assert.equal(result.signal.currencyStrength.pairs.length, 21);
  assert.ok(result.signal.currencyStrength.strongest.length >= 3);
  assert.ok(result.signal.currencyStrength.weakest.length >= 3);
  assert.ok(result.signal.currencyStrength.currencies.every((currency) => Number.isFinite(currency.score)));
});

test("currency strength map can be skipped for fast scan mode", async () => {
  const strength = await buildCurrencyStrengthMap({ provider: "demo", interval: "1h", includeContext: false });
  assert.equal(strength.enabled, false);
  assert.equal(strength.currencies.length, 7);
});

test("research roadmap keeps safe output rules", () => {
  const roadmap = researchRoadmap();
  assert.ok(roadmap.guardrails.some((item) => item.includes("未来データを使わない")));
  assert.ok(roadmap.guardrails.some((item) => item.includes("実売買とX投稿はユーザー")));
});

test("all demo assets can be analyzed for scan view", async () => {
  const assets = listAssets();
  const results = await Promise.all(
    assets.map((asset) => analyzeSymbol(asset.symbol, { provider: "demo" }))
  );
  assert.equal(results.length, assets.length);
  assert.equal(results.every((result) => result.ok), true);
  assert.equal(results.every((result) => result.signal.dataQuality.score >= 90), true);
  assert.equal(results.every((result) => result.signal.intelligence.autoTradeGate.analysisOnly), true);
});

test("daily learning stores one signal per asset without duplicate same-day records", async () => {
  const learningDir = await mkdtemp(join(tmpdir(), "market-ai-learning-"));
  const expected = listAssets().length;
  const first = await runDailyLearning({ provider: "demo", learningDir, date: "2026-06-28" });
  const second = await runDailyLearning({ provider: "demo", learningDir, date: "2026-06-28" });
  assert.equal(first.totals.newSignals, expected);
  assert.equal(first.totals.signals, expected);
  assert.equal(second.totals.newSignals, 0);
  assert.equal(second.totals.signals, expected);
  assert.ok(second.totals.pendingOutcomes >= 0);
});

test("universe audit can write a prioritized report", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "market-ai-universe-"));
  const result = await auditUniverse({ outputDir, concurrency: 12, date: "2026-06-28", useDemo: true });
  assert.equal(result.summary.total, listAssets().length);
  assert.equal(result.rows.length, listAssets().length);
  assert.equal(typeof result.rows[0].priorityScore, "number");
  assert.ok(result.summary.topPriority.length <= 20);
});

test("universe audit separates source failures from unavailable symbols", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "market-ai-universe-source-failure-"));
  const result = await auditUniverse({
    outputDir,
    concurrency: 20,
    date: "2026-06-28",
    fetchCandles: async () => ({
      candles: [],
      source: "free-stooq",
      warning: "無料データ取得に失敗しました: fetch failed"
    })
  });
  assert.equal(result.summary.sourceFailures, listAssets().length);
  assert.equal(result.summary.unavailable, 0);
  assert.equal(result.rows.every((row) => row.status === UNIVERSE_STATUS.sourceFailure), true);
  assert.equal(classifyDataStatus([], { usable: false }, "無料データが空でした。"), UNIVERSE_STATUS.unavailable);
});
