import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const learningDir = join(rootDir, "data", "learning");
const reportsDir = join(rootDir, "reports");
const reportPattern = /^(?:site-)?market-ai-daily-learning-(\d{4}-\d{2}-\d{2})(?:-\d{4})?\.md$/;

async function readJsonlStats(name) {
  const text = await readFile(join(learningDir, name), "utf8");
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const unique = new Set(rows.map((row) => row.id).filter(Boolean)).size;
  return { rows: rows.length, unique, duplicates: rows.length - unique };
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(join(learningDir, "codex-import.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function readLearningArchive() {
  const [manifest, signals, outcomes, names] = await Promise.all([
    readManifest(),
    readJsonlStats("signals.jsonl"),
    readJsonlStats("outcomes.jsonl"),
    readdir(reportsDir)
  ]);
  const reports = names
    .map((name) => ({ name, match: name.match(reportPattern) }))
    .filter((item) => item.match)
    .map((item) => ({ date: item.match[1], path: `reports/${item.name}` }))
    .sort((a, b) => b.path.localeCompare(a.path));

  return {
    integrated: Boolean(manifest),
    importedAt: manifest?.importedAt || null,
    source: manifest?.source || null,
    dataPolicy: manifest?.dataPolicy || null,
    signals,
    outcomes,
    reports: {
      count: reports.length,
      firstDate: reports.at(-1)?.date || null,
      lastDate: reports[0]?.date || null,
      recent: reports.slice(0, 8)
    },
    automationMemoryImported: Boolean(manifest?.automationMemory)
  };
}
