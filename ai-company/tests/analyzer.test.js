import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSymbol, listAssets, researchRoadmap } from "../src/analyzer.js";
import { backtestCandidate, runModelTournament } from "../src/backtest.js";
import { trendBreakoutCandidate } from "../src/candidates.js";
import { generateDemoCandles } from "../src/dataProvider.js";

test("asset universe includes XAUUSD metals and excludes USB", () => {
  const symbols = listAssets().map((asset) => asset.symbol);
  const groups = listAssets().map((asset) => asset.group);
  assert.ok(symbols.includes("XAUUSD"));
  assert.ok(symbols.includes("XAGUSD"));
  assert.ok(symbols.includes("XPTUSD"));
  assert.equal(symbols.includes("USB"), false);
  assert.ok(groups.includes("貴金属"));
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
  const results = await Promise.all(
    listAssets().map((asset) => analyzeSymbol(asset.symbol, { provider: "demo" }))
  );
  assert.equal(results.length, 14);
  assert.equal(results.every((result) => result.ok), true);
  assert.equal(results.every((result) => result.signal.dataQuality.score >= 90), true);
});
