import test from "node:test";
import assert from "node:assert/strict";
import { appendFile, mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listAssets } from "../src/analyzer.js";
import { runDailyLearning } from "../src/learning.js";

test("daily learning removes duplicate signal records before saving the summary", async () => {
  const learningDir = await mkdtemp(join(tmpdir(), "market-ai-learning-dedup-"));
  const date = "2026-06-28";
  const first = await runDailyLearning({ provider: "demo", intervals: ["1d"], learningDir, date, stage: "signals" });
  const signalsPath = join(learningDir, "signals.jsonl");
  const firstRow = (await readFile(signalsPath, "utf8")).split(/\r?\n/).filter(Boolean)[0];
  await appendFile(signalsPath, `${firstRow}\n`, "utf8");

  const second = await runDailyLearning({ provider: "demo", intervals: ["1d"], learningDir, date, stage: "signals" });
  const rows = (await readFile(signalsPath, "utf8")).split(/\r?\n/).filter(Boolean);
  assert.equal(first.totals.signals, listAssets().length);
  assert.equal(second.totals.uniqueSignals, listAssets().length);
  assert.equal(rows.length, listAssets().length);
  assert.equal(second.totals.duplicateSignals, 0);
});
