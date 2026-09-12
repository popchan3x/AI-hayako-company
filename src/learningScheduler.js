import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rebuildLearningSummary, runDailyLearning } from "./learning.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const logPath = join(rootDir, "logs", "auto-learning.jsonl");
const reportsDir = join(rootDir, "reports");
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

async function readLogs() {
  try {
    const text = await readFile(logPath, "utf8");
    return text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function appendLog(row) {
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(row)}\n`, "utf8");
}

function buildReport({ date, provider, intervals, trigger, status, summary, runTotals, error, startedAt, finishedAt }) {
  const durationSeconds = Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 1000);
  return [
    `# サイト統合 日次学習レポート ${date}`,
    "",
    "## 結論",
    status === "success"
      ? `日次学習は成功しました。${intervals.length}種類の時間足をサイト内で実行しました。`
      : `日次学習は失敗しました。${error}`,
    "",
    "## 実行情報",
    `- 実行元: ${trigger === "scheduled" ? "サイト自動実行" : "サイト手動実行"}`,
    `- データ: ${provider}`,
    `- 時間足: ${intervals.join(", ")}`,
    `- 開始: ${startedAt}`,
    `- 完了: ${finishedAt}`,
    `- 所要時間: ${durationSeconds}秒`,
    "",
    "## 結果",
    `- 累計シグナル: ${summary?.totals?.signals ?? 0}件`,
    `- 一意のシグナル: ${summary?.totals?.uniqueSignals ?? summary?.totals?.signals ?? 0}件`,
    `- 今回の新規シグナル: ${runTotals?.newSignals ?? 0}件`,
    `- 累計答え合わせ: ${summary?.totals?.outcomes ?? 0}件`,
    `- 一意の答え合わせ: ${summary?.totals?.uniqueOutcomes ?? summary?.totals?.outcomes ?? 0}件`,
    `- 今回の新規答え合わせ: ${runTotals?.newOutcomes ?? 0}件`,
    `- 未評価: ${summary?.totals?.pendingOutcomes ?? 0}件`,
    `- 信頼度点検: ${summary?.confidenceHealth?.summary ?? "未集計"}`,
    "",
    "## 次のアクション",
    ...(summary?.nextActions?.length ? summary.nextActions.map((item, index) => `${index + 1}. ${item}`) : ["1. 次回の日次学習を待ちます。"]),
    ""
  ].join("\n");
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
  const retryMinutes = Number(options.retryMinutes ?? process.env.HAYAKO_LEARNING_RETRY_MINUTES ?? 30);
  const state = {
    enabled,
    provider,
    intervals,
    hour,
    minute,
    retryMinutes,
    initialized: false,
    running: false,
    currentInterval: null,
    lastRunDate: null,
    lastRunStatus: null,
    lastRunTrigger: null,
    lastStartedAt: null,
    lastFinishedAt: null,
    lastSummary: null,
    lastRunTotals: null,
    lastReport: null,
    lastError: null,
    nextRetryAt: null
  };

  const ready = (async () => {
    const rows = await readLogs();
    const latest = rows.at(-1);
    const latestSuccess = [...rows].reverse().find((row) => row.status === "success");
    if (latestSuccess) state.lastRunDate = latestSuccess.date;
    if (latest) {
      state.lastRunStatus = latest.status;
      state.lastRunTrigger = latest.trigger || "scheduled";
      state.lastStartedAt = latest.startedAt || null;
      state.lastFinishedAt = latest.finishedAt || latest.generatedAt || null;
      state.lastRunTotals = latest.runTotals || null;
      state.lastReport = latest.report || null;
      state.lastError = latest.error || null;
    }
    state.initialized = true;
  })().catch((error) => {
    state.initialized = true;
    state.lastError = `学習履歴の読込に失敗しました: ${error.message}`;
  });

  async function execute(trigger = "manual") {
    await ready;
    if (state.running) throw new Error("日次学習はすでに実行中です。");

    const date = jstParts().date;
    const startedAt = new Date().toISOString();
    const runTotals = { newSignals: 0, newOutcomes: 0 };
    let latestSummary = null;
    state.running = true;
    state.lastRunTrigger = trigger;
    state.lastStartedAt = startedAt;
    state.lastFinishedAt = null;
    state.lastRunStatus = "running";
    state.lastError = null;
    state.nextRetryAt = null;

    try {
      for (const interval of intervals) {
        state.currentInterval = interval;
        latestSummary = await runDailyLearning({ provider, intervals: [interval], date });
        runTotals.newSignals += latestSummary.totals.newSignals || 0;
        runTotals.newOutcomes += latestSummary.totals.newOutcomes || 0;
      }

      latestSummary = await rebuildLearningSummary({
        provider,
        intervals,
        runTotals,
        runScope: `${date} ${trigger === "scheduled" ? "サイト自動実行" : "サイト手動実行"}の全時間足合算`
      });

      const finishedAt = new Date().toISOString();
      const reportName = `site-market-ai-daily-learning-${date}.md`;
      const reportPath = join(reportsDir, reportName);
      await mkdir(reportsDir, { recursive: true });
      await writeFile(reportPath, buildReport({
        date,
        provider,
        intervals,
        trigger,
        status: "success",
        summary: latestSummary,
        runTotals,
        startedAt,
        finishedAt
      }), "utf8");

      Object.assign(state, {
        lastRunDate: date,
        lastRunStatus: "success",
        lastFinishedAt: finishedAt,
        lastSummary: latestSummary,
        lastRunTotals: runTotals,
        lastReport: `reports/${reportName}`,
        lastError: null
      });
      await appendLog({
        date,
        status: "success",
        trigger,
        provider,
        intervals,
        startedAt,
        finishedAt,
        totals: latestSummary.totals,
        runTotals,
        report: state.lastReport
      });
      return latestSummary;
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const nextRetryAt = new Date(Date.now() + retryMinutes * 60 * 1000).toISOString();
      Object.assign(state, {
        lastRunStatus: "failed",
        lastFinishedAt: finishedAt,
        lastRunTotals: runTotals,
        lastError: error.message,
        nextRetryAt
      });
      await appendLog({
        date,
        status: "failed",
        trigger,
        provider,
        intervals,
        startedAt,
        finishedAt,
        runTotals,
        error: error.message,
        nextRetryAt
      });
      throw error;
    } finally {
      state.running = false;
      state.currentInterval = null;
    }
  }

  async function tick() {
    await ready;
    if (!state.enabled || state.running) return;
    const now = jstParts();
    const currentMinutes = now.hour * 60 + now.minute;
    const scheduledMinutes = hour * 60 + minute;
    const retryBlocked = state.nextRetryAt && Date.now() < Date.parse(state.nextRetryAt);
    if (currentMinutes < scheduledMinutes || state.lastRunDate === now.date || retryBlocked) return;
    try {
      await execute("scheduled");
    } catch {
      // 状態とログはexecute内で保存済み。次の再試行時刻まで待つ。
    }
  }

  const timer = setInterval(tick, 60 * 1000);
  timer.unref?.();
  setTimeout(tick, 1000).unref?.();

  return {
    state,
    ready,
    stop() {
      clearInterval(timer);
      state.enabled = false;
    },
    runNow() {
      return execute("manual");
    }
  };
}
