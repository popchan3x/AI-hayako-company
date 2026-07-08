import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { normalizeTimeframe } from "../src/dataProvider.js";
import { runDailyLearning } from "../src/learning.js";

const args = process.argv.slice(2);
const scriptPath = fileURLToPath(import.meta.url);

function argValue(name) {
  const arg = args.find((value) => value.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : undefined;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function parseIntervals(value) {
  return value ? value.split(",").map((item) => normalizeTimeframe(item.trim())).filter(Boolean) : undefined;
}

function parseTimeout(name, fallback) {
  const value = Number(argValue(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function childArgsForInterval(interval) {
  const filtered = args.filter((arg) => (
    !arg.startsWith("--intervals=")
    && !arg.startsWith("--interval-timeout-ms=")
    && !arg.startsWith("--interval-timeout-1d-ms=")
    && arg !== "--no-split"
  ));
  return [...filtered, `--intervals=${interval}`, "--no-split"];
}

function parseChildSummary(stdout) {
  const text = stdout.trim();
  if (!text) return null;
  return JSON.parse(text);
}

function runInterval(interval, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [scriptPath, ...childArgsForInterval(interval)], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      let summary = null;
      let parseError = null;
      if (!timedOut && code === 0) {
        try {
          summary = parseChildSummary(stdout);
        } catch (error) {
          parseError = error.message;
        }
      }
      resolve({
        interval,
        ok: code === 0 && !timedOut && !parseError,
        code,
        signal,
        timedOut,
        timeoutMs,
        durationMs,
        summary,
        parseError,
        stderr: stderr.trim() || undefined,
        stdoutTail: !summary && stdout ? stdout.slice(-1000) : undefined
      });
    });
  });
}

async function runSplitByInterval({ provider, intervals, stage }) {
  const normalTimeoutMs = parseTimeout("interval-timeout-ms", 240000);
  const oneDayTimeoutMs = parseTimeout("interval-timeout-1d-ms", 600000);
  const runs = [];
  let latestSummary = null;

  for (const interval of intervals) {
    const timeoutMs = interval === "1d" ? oneDayTimeoutMs : normalTimeoutMs;
    console.error(`[daily-learn] interval ${interval} start (timeout ${timeoutMs}ms)`);
    const result = await runInterval(interval, timeoutMs);
    runs.push(result);
    if (result.summary) latestSummary = result.summary;
    const status = result.ok ? "ok" : result.timedOut ? "timeout" : "failed";
    console.error(`[daily-learn] interval ${interval} ${status} (${(result.durationMs / 1000).toFixed(1)}s)`);
  }

  const failed = runs.filter((run) => !run.ok);
  const summary = {
    ...(latestSummary || {
      generatedAt: new Date().toISOString(),
      provider,
      intervals,
      totals: { signals: 0, newSignals: 0, outcomes: 0, newOutcomes: 0, pendingOutcomes: 0 },
      byModel: [],
      byRegime: [],
      byTimeframe: [],
      bySymbol: [],
      calibration: [],
      nextActions: []
    }),
    generatedAt: new Date().toISOString(),
    provider,
    intervals,
    splitExecution: {
      mode: "interval",
      ok: failed.length === 0,
      completedIntervals: runs.filter((run) => run.ok).map((run) => run.interval),
      failedIntervals: failed.map((run) => run.interval),
      runs: runs.map((run) => ({
        interval: run.interval,
        ok: run.ok,
        timedOut: run.timedOut,
        timeoutMs: run.timeoutMs,
        durationMs: run.durationMs,
        code: run.code,
        signal: run.signal,
        totals: run.summary?.totals,
        parseError: run.parseError,
        stderr: run.stderr,
        stdoutTail: run.stdoutTail
      }))
    }
  };

  console.log(JSON.stringify(summary, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

const provider = argValue("provider") || "demo";
const intervals = parseIntervals(argValue("intervals"));
const stage = argValue("stage");

if (!hasFlag("no-split") && intervals?.length > 1) {
  await runSplitByInterval({ provider, intervals, stage });
} else {
  const summary = await runDailyLearning({ provider, intervals, stage });
  console.log(JSON.stringify(summary, null, 2));
}
