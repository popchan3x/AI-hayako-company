import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { rebuildLearningSummary } from "../src/learning.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const learningDir = join(rootDir, "data", "learning");
const signalsPath = join(learningDir, "signals.jsonl");
const outcomesPath = join(learningDir, "outcomes.jsonl");
const summaryJsonPath = join(learningDir, "learning-summary.json");
const summaryMdPath = join(learningDir, "learning-summary.md");
const importManifestPath = join(learningDir, "codex-import.json");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = join(learningDir, "backups", `before-consolidation-${timestamp}`);

async function readJsonl(path) {
  const text = await readFile(path, "utf8");
  return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function dedupeLatest(rows, dateField) {
  const byId = new Map();
  const order = [];
  for (const row of rows) {
    if (!byId.has(row.id)) order.push(row.id);
    const current = byId.get(row.id);
    const currentTime = Date.parse(current?.[dateField] || "") || 0;
    const candidateTime = Date.parse(row[dateField] || "") || 0;
    if (!current || candidateTime >= currentTime) byId.set(row.id, row);
  }
  return order.map((id) => byId.get(id));
}

async function writeJsonlAtomically(path, rows) {
  const temporaryPath = `${path}.consolidating`;
  await writeFile(temporaryPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
  await rename(temporaryPath, path);
}

await mkdir(backupDir, { recursive: true });
for (const path of [signalsPath, outcomesPath, summaryJsonPath, summaryMdPath, importManifestPath]) {
  await copyFile(path, join(backupDir, path.split(/[\\/]/).at(-1)));
}

const signalsBefore = await readJsonl(signalsPath);
const outcomesBefore = await readJsonl(outcomesPath);
const signalsAfter = dedupeLatest(signalsBefore, "generatedAt");
const outcomesAfter = dedupeLatest(outcomesBefore, "evaluatedAt");

await writeJsonlAtomically(signalsPath, signalsAfter);
await writeJsonlAtomically(outcomesPath, outcomesAfter);
const summary = await rebuildLearningSummary({ provider: "combined" });

const importManifest = JSON.parse(await readFile(importManifestPath, "utf8"));
importManifest.consolidation = {
  completedAt: new Date().toISOString(),
  policy: "同じIDは最新のgeneratedAtまたはevaluatedAtを持つ1件に統合する。",
  backupDirectory: relative(rootDir, backupDir).replaceAll("\\", "/"),
  signals: {
    before: signalsBefore.length,
    after: signalsAfter.length,
    removedDuplicates: signalsBefore.length - signalsAfter.length
  },
  outcomes: {
    before: outcomesBefore.length,
    after: outcomesAfter.length,
    removedDuplicates: outcomesBefore.length - outcomesAfter.length
  }
};
importManifest.signals = { rows: signalsAfter.length, unique: signalsAfter.length, duplicates: 0 };
importManifest.outcomes = { rows: outcomesAfter.length, unique: outcomesAfter.length, duplicates: 0 };
await writeFile(importManifestPath, `${JSON.stringify(importManifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  ok: true,
  backupDirectory: importManifest.consolidation.backupDirectory,
  signals: importManifest.consolidation.signals,
  outcomes: importManifest.consolidation.outcomes,
  summaryTotals: summary.totals
}, null, 2));
