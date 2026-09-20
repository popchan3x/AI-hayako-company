import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { round } from "./indicators.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const defaultSummaryPath = join(rootDir, "data", "learning", "learning-summary.json");
let cachedSummary = null;
let cachedSummaryPath = null;
let cachedSummaryMtimeMs = 0;

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function findRow(rows, name) {
  return rows?.find((row) => row.name === name) || null;
}

function rowScore(row, label) {
  if (!row || (row.count || 0) < 30) {
    return {
      label,
      score: 50,
      status: "データ不足",
      detail: `${label}は30件未満のため、まだ強弱を決めません。`
    };
  }

  const averageNetReturn = Number(row.averageNetReturn) || 0;
  const winRate = Number(row.winRate) || 0;
  let score = 50;
  score += clamp(averageNetReturn * 85, -35, 35);
  score += winRate >= 55 ? clamp((winRate - 55) * 0.35, 0, 14) : -clamp((55 - winRate) * 0.65, 0, 22);
  if (averageNetReturn <= 0) score -= 14;

  const boundedScore = Math.round(clamp(score));
  const status = averageNetReturn > 0 && winRate >= 55 ? "利益あり"
    : averageNetReturn > 0 ? "条件付き"
      : winRate >= 70 ? "勝率高いが損益注意"
        : "要改善";

  return {
    label,
    score: boundedScore,
    status,
    count: row.count,
    winRate,
    averageNetReturn,
    netReturn: Number(row.netReturn) || 0,
    detail: `${label}は${row.count}件、勝率${winRate}%、平均損益${averageNetReturn}%です。`
  };
}

function combinedScore(checks, summary) {
  const weights = {
    "銘柄": 1.3,
    "時間足": 1.15,
    "モデル": 1.25
  };
  const totalWeight = checks.reduce((sum, check) => sum + (weights[check.label] || 1), 0);
  let score = checks.reduce((sum, check) => sum + check.score * (weights[check.label] || 1), 0) / totalWeight;
  if (summary?.confidenceHealth?.status === "要修正") score -= 8;
  return Math.round(clamp(score));
}

function statusFromScore(score) {
  if (score >= 75) return "利益優先";
  if (score >= 60) return "条件付き";
  if (score >= 45) return "弱い";
  return "見送り優先";
}

async function readSummary(summaryPath) {
  try {
    const summaryStat = await stat(summaryPath);
    if (cachedSummary && cachedSummaryPath === summaryPath && cachedSummaryMtimeMs === summaryStat.mtimeMs) {
      return cachedSummary;
    }
    cachedSummary = JSON.parse(await readFile(summaryPath, "utf8"));
    cachedSummaryPath = summaryPath;
    cachedSummaryMtimeMs = summaryStat.mtimeMs;
    return cachedSummary;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function buildPerformanceGuard({ symbol, interval, leadModel, confidence, summary, summaryPath = defaultSummaryPath } = {}) {
  const learningSummary = summary || await readSummary(summaryPath);
  if (!learningSummary) {
    return {
      score: 50,
      status: "データ不足",
      confidenceAdjustment: 0,
      confidenceCap: 80,
      shouldStandAside: false,
      summary: "過去成績はまだ読み込めません。",
      checks: []
    };
  }

  const checks = [
    rowScore(findRow(learningSummary.bySymbol, symbol), "銘柄"),
    rowScore(findRow(learningSummary.byTimeframe, interval), "時間足"),
    rowScore(findRow(learningSummary.byModel, leadModel), "モデル")
  ];
  const score = combinedScore(checks, learningSummary);
  const scoreStatus = statusFromScore(score);
  const positiveChecks = checks.filter((check) => check.averageNetReturn > 0 && (check.count || 0) >= 30).length;
  const negativeCore = checks.filter((check) => check.averageNetReturn <= 0 && (check.count || 0) >= 30).length;
  const highConfidenceBroken = learningSummary.confidenceHealth?.status === "要修正";
  const confidenceAdjustment = score >= 75 ? 5
    : score >= 60 ? 0
      : score >= 45 ? -10
        : -20;
  const confidenceCap = score >= 75 ? 88
    : score >= 60 ? 80
      : score >= 45 ? 70
        : 62;
  const finalCap = highConfidenceBroken ? Math.min(confidenceCap, 74) : confidenceCap;
  const weakAcrossCoreChecks = negativeCore >= 2 && positiveChecks < 2;
  const brokenHighConfidence = highConfidenceBroken && confidence >= 75 && positiveChecks < 2;
  const shouldStandAside = score < 45 || weakAcrossCoreChecks || brokenHighConfidence;
  const status = shouldStandAside ? "見送り優先" : scoreStatus;
  const strongest = [...checks].sort((a, b) => b.score - a.score)[0];
  const weakest = [...checks].sort((a, b) => a.score - b.score)[0];

  return {
    score,
    status,
    confidenceAdjustment,
    confidenceCap: finalCap,
    shouldStandAside,
    positiveChecks,
    negativeCore,
    weakAcrossCoreChecks,
    brokenHighConfidence,
    strongest,
    weakest,
    checks,
    summary: `過去成績点検は${status}です。最も強い材料は${strongest.label}${strongest.score}/100、最も弱い材料は${weakest.label}${weakest.score}/100です。`
  };
}

export function profitLeaders(summary, limit = 8) {
  const select = (rows = []) => rows
    .filter((row) => (row.count || 0) >= 30 && Number(row.averageNetReturn) > 0)
    .sort((a, b) => b.averageNetReturn - a.averageNetReturn)
    .slice(0, limit)
    .map((row) => ({
      name: row.name,
      count: row.count,
      winRate: row.winRate,
      averageNetReturn: row.averageNetReturn,
      netReturn: round(row.netReturn, 4)
    }));
  return {
    symbols: select(summary?.bySymbol),
    timeframes: select(summary?.byTimeframe),
    models: select(summary?.byModel)
  };
}
