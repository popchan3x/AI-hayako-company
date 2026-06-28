import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runDailyLearning } from "./learning.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const logPath = join(rootDir, "logs", "auto-learning.jsonl");
const defaultIntervals = ["1m", "5m", "15m", "1h", "4h", "1d"];

function jstParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute)
  };
}

async function appendLog(row) {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(row)}\n`, "utf8");
}

export function startAutoLearningScheduler(options = {}) {
  const enabled = options.enabled ?? process.env.HAYAKO_AUTO_LEARN !== "false";
  const provider = options.provider || process.env.HAYAKO_LEARNING_PROVIDER || "free-composite";
  const intervals = options.intervals || (process.env.HAYAKO_LEARNING_INTERVALS || defaultIntervals.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const hour = Number(options.hour ?? process.env.HAYAKO_LEARNING_HOUR ?? 9);
  const minute = Number(options.minute ?? process.env.HAYAKO_LEARNING_MINUTE ?? 0);
  const windowMinutes = Number(options.windowMinutes ?? process.env.HAYAKO_LEARNING_WINDOW_MINUTES ?? 10);
  const state = {
    enabled,
    provider,
    intervals,
    hour,
    minute,
    windowMinutes,
    lastRunDate: null,
    running: false,
    lastSummary: null,
    lastError: null
  };

  async function tick() {
    if (!state.enabled || state.running) return;
    const now = jstParts();
    const currentMinutes = now.hour * 60 + now.minute;
    const scheduledMinutes = hour * 60 + minute;
    const inWindow = currentMinutes >= scheduledMinutes && currentMinutes < scheduledMinutes + windowMinutes;
    if (!inWindow || state.lastRunDate === now.date) return;

    state.running = true;
    state.lastRunDate = now.date;
    try {
      const summary = await runDailyLearning({ provider, intervals, date: now.date });
      state.lastSummary = summary;
      state.lastError = null;
      await appendLog({
        date: now.date,
        status: "success",
        provider,
        intervals,
        totals: summary.totals,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      state.lastError = error.message;
      await appendLog({
        date: now.date,
        status: "failed",
        provider,
        intervals,
        error: error.message,
        generatedAt: new Date().toISOString()
      });
    } finally {
      state.running = false;
    }
  }

  const timer = setInterval(tick, 60 * 1000);
  timer.unref?.();
  setTimeout(tick, 1000).unref?.();

  return {
    state,
    stop() {
      clearInterval(timer);
      state.enabled = false;
    },
    runNow() {
      return runDailyLearning({ provider, intervals });
    }
  };
}
