import test from "node:test";
import assert from "node:assert/strict";
import { buildPerformanceGuard } from "../src/performanceMemory.js";

function row(name, averageNetReturn, winRate = 60) {
  return {
    name,
    count: 100,
    wins: Math.round(winRate),
    winRate,
    averageNetReturn,
    netReturn: averageNetReturn * 100
  };
}

test("performance guard stands aside when timeframe and model both lose", async () => {
  const summary = {
    confidenceHealth: { status: "要修正" },
    bySymbol: [row("LEADER", 0.4, 65)],
    byTimeframe: [row("1h", -0.1, 80)],
    byModel: [row("Range Reversion", -0.2, 78)]
  };

  const guard = await buildPerformanceGuard({
    symbol: "LEADER",
    interval: "1h",
    leadModel: "Range Reversion",
    confidence: 60,
    summary
  });

  assert.equal(guard.positiveChecks, 1);
  assert.equal(guard.negativeCore, 2);
  assert.equal(guard.weakAcrossCoreChecks, true);
  assert.equal(guard.shouldStandAside, true);
  assert.equal(guard.status, "見送り優先");
});

test("performance guard keeps a candidate when all three checks are profitable", async () => {
  const summary = {
    confidenceHealth: { status: "通常" },
    bySymbol: [row("LEADER", 0.4, 65)],
    byTimeframe: [row("1h", 0.2, 62)],
    byModel: [row("Range Reversion", 0.15, 61)]
  };

  const guard = await buildPerformanceGuard({
    symbol: "LEADER",
    interval: "1h",
    leadModel: "Range Reversion",
    confidence: 75,
    summary
  });

  assert.equal(guard.positiveChecks, 3);
  assert.equal(guard.negativeCore, 0);
  assert.equal(guard.weakAcrossCoreChecks, false);
  assert.equal(guard.shouldStandAside, false);
  assert.notEqual(guard.status, "見送り優先");
});
