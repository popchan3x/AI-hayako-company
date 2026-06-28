import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSymbol, listAssets, researchRoadmap } from "../src/analyzer.js";
import { backtestCandidate, runModelTournament } from "../src/backtest.js";
import { trendBreakoutCandidate } from "../src/candidates.js";
import { fetchFreeCandles, fetchYahooCandles, generateDemoCandles, resolveYahooSymbol } from "../src/dataProvider.js";
import { runDailyLearning } from "../src/learning.js";
import { auditUniverse, classifyDataStatus, UNIVERSE_STATUS } from "../src/universeAudit.js";
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
  assert.equal(typeof result.signal.intelligence.edgeScore, "number");
  assert.equal(result.signal.intelligence.autoTradeGate.canAutoTrade, false);
  assert.equal(result.signal.intelligence.sourceSafety.noExternalCodeExecuted, true);
  assert.ok(result.signal.intelligence.factors.length >= 8);
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
