import { appendFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const reportsDir = join(rootDir, "reports");
const learningDir = join(rootDir, "data", "learning");
const logPath = join(rootDir, "logs", "auto-learning.jsonl");
const manifestPath = join(learningDir, "codex-import.json");
const reportPattern = /^market-ai-daily-learning-(\d{4}-\d{2}-\d{2})(?:-\d{4})?\.md$/;

function argValue(name) {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

async function readJsonlStats(path, keyName) {
  const text = await readFile(path, "utf8");
  const rows = text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const unique = new Set(rows.map((row) => row[keyName]).filter(Boolean)).size;
  return { rows: rows.length, unique, duplicates: rows.length - unique };
}

async function readExistingImportedReports() {
  try {
    const text = await readFile(logPath, "utf8");
    return new Set(text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line).report).filter(Boolean));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

const reportFiles = (await readdir(reportsDir))
  .filter((name) => reportPattern.test(name))
  .sort();
const existingReports = await readExistingImportedReports();
const importedReports = [];

await mkdir(dirname(logPath), { recursive: true });
for (const name of reportFiles) {
  const date = name.match(reportPattern)[1];
  const report = `reports/${name}`;
  const fileStat = await stat(join(reportsDir, name));
  importedReports.push({ date, report, modifiedAt: fileStat.mtime.toISOString() });
  if (existingReports.has(report)) continue;
  await appendFile(logPath, `${JSON.stringify({
    date,
    status: "imported",
    trigger: "codex-history",
    source: "Market AI daily learning",
    report,
    generatedAt: fileStat.mtime.toISOString()
  })}\n`, "utf8");
}

const memoryArgument = argValue("memory");
let automationMemory = null;
if (memoryArgument) {
  const memoryPath = resolve(memoryArgument);
  automationMemory = {
    sourceFile: basename(memoryPath),
    content: await readFile(memoryPath, "utf8")
  };
}

const manifest = {
  version: 1,
  importedAt: new Date().toISOString(),
  source: {
    automationId: "market-ai-daily-learning",
    name: "Market AI daily learning",
    statusAfterImport: "PAUSED"
  },
  dataPolicy: "既存のsignals.jsonlとoutcomes.jsonlをサイトの正式な累積学習データとして採用し、重複コピーは作成しない。",
  signals: await readJsonlStats(join(learningDir, "signals.jsonl"), "id"),
  outcomes: await readJsonlStats(join(learningDir, "outcomes.jsonl"), "id"),
  reports: importedReports,
  automationMemory
};

await mkdir(learningDir, { recursive: true });
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
  ok: true,
  manifest: "data/learning/codex-import.json",
  reports: manifest.reports.length,
  signals: manifest.signals,
  outcomes: manifest.outcomes,
  memoryImported: Boolean(automationMemory)
}, null, 2));
