import test from "node:test";
import assert from "node:assert/strict";
import { analyzeSymbol, listAssets } from "../src/analyzer.js";
import { backtestCandidate } from "../src/backtest.js";
import { trendBreakoutCandidate } from "../src/candidates.js";
import { generateDemoCandles } from "../src/dataProvider.js";

test("asset universe includes XAUUSD metals and excludes USB", () => {
  const symbols = listAssets().map((asset) => asset.symbol);
  assert.ok(symbols.includes("XAUUSD"));
  assert.ok(symbols.includes("XAGUSD"));
  assert.ok(symbols.includes("XPTUSD"));
  assert.equal(symbols.includes("USB"), false);
});

test("analyzer returns priced validation signal with reasons and warnings", async () => {
  const result = await analyzeSymbol("XAUUSD", { provider: "demo" });
  assert.equal(result.ok, true);
  assert.equal(result.signal.validationLabel, "検証用シグナル");
  assert.ok(["買い", "売り", "見送り"].includes(result.signal.direction));
  assert.equal(typeof result.signal.entryPrice, "number");
  assert.equal(typeof result.signal.stopLoss, "number");
  assert.equal(typeof result.signal.takeProfit, "number");
  assert.ok(result.signal.reasons.length >= 3);
  assert.ok(result.signal.reasons.length <= 5);
  assert.ok(result.signal.warnings.length >= 2);
  assert.match(result.signal.xDraft, /直接の売買推奨ではなく/);
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
  assert.ok(metrics.trades >= 0);
});
