import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSymbol, listAssets } from "./analyzer.js";
import { getCandles } from "./dataProvider.js";
import { round } from "./indicators.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const defaultLearningDir = join(rootDir, "data", "learning");
const horizons = [4, 8, 16];

function isoDateJst(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function readJsonl(path) {
  try {
    const text = await readFile(path, "utf8");
    return text.trim()
      ? text.trim().split(/\r?\n/).map((line) => JSON.parse(line))
      : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function appendJsonl(path, rows) {
  if (rows.length === 0) return;
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
}

function signalKey(record) {
  return `${record.date}|${record.provider}|${record.symbol}`;
}

function outcomeKey(signal, horizon) {
  return `${signal.id}|${horizon}`;
}

function buildSignalRecord(result, provider, date) {
  const signal = result.signal;
  return {
    id: `${date}-${provider}-${result.symbol}`,
    date,
    generatedAt: result.generatedAt,
    provider,
    symbol: result.symbol,
    assetName: result.asset.name,
    group: result.asset.group,
    direction: signal.direction,
    confidence: signal.confidence,
    entryPrice: signal.entryPrice,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    selectedModel: signal.selectedModel,
    leadModel: signal.leadModel,
    regime: signal.marketRegime.name,
    riskLevel: signal.marketRegime.riskLevel,
    modelAgreement: signal.modelAgreement,
    dataQualityScore: signal.dataQuality.score,
    costBps: signal.costs.totalBps,
    voteWeights: signal.voteWeights,
    firstReason: signal.reasons[0],
    status: "pending"
  };
}

function outcomeReturn(signal, exitClose) {
  if (signal.direction === "買い") return (exitClose - signal.entryPrice) / signal.entryPrice;
  if (signal.direction === "売り") return (signal.entryPrice - exitClose) / signal.entryPrice;
  return 0;
}

function findSignalIndex(candles, signal) {
  const generatedAt = new Date(signal.generatedAt).getTime();
  const firstAfter = candles.findIndex((candle) => new Date(candle.time).getTime() > generatedAt);
  if (firstAfter >= 0) return firstAfter;
  return candles.findIndex((candle) => Math.abs(candle.close - signal.entryPrice) / signal.entryPrice < 0.002);
}

function evaluateSignal(signal, candles, horizon) {
  const startIndex = findSignalIndex(candles, signal);
  if (startIndex < 0 || startIndex + horizon >= candles.length) return null;
  const window = candles.slice(startIndex, startIndex + horizon + 1);
  const exit = window.at(-1);
  const rawReturn = outcomeReturn(signal, exit.close);
  const costRate = (signal.costBps || 0) / 10000;
  const netReturn = signal.direction === "見送り" ? 0 : rawReturn - costRate;
  const reachedTarget = signal.direction === "買い"
    ? window.some((candle) => candle.high >= signal.takeProfit)
    : signal.direction === "売り"
      ? window.some((candle) => candle.low <= signal.takeProfit)
      : false;
  const reachedStop = signal.direction === "買い"
    ? window.some((candle) => candle.low <= signal.stopLoss)
    : signal.direction === "売り"
      ? window.some((candle) => candle.high >= signal.stopLoss)
      : false;

  return {
    id: outcomeKey(signal, horizon),
    signalId: signal.id,
    date: isoDateJst(),
    symbol: signal.symbol,
    provider: signal.provider,
    horizon,
    direction: signal.direction,
    confidence: signal.confidence,
    leadModel: signal.leadModel,
    regime: signal.regime,
    entryPrice: signal.entryPrice,
    exitPrice: round(exit.close, signal.entryPrice < 2 ? 5 : 3),
    rawReturn: round(rawReturn * 100, 4),
    netReturn: round(netReturn * 100, 4),
    success: signal.direction === "見送り" ? Math.abs(rawReturn) < costRate : netReturn > 0,
    reachedTarget,
    reachedStop,
    evaluatedAt: new Date().toISOString()
  };
}

function summarizeGroup(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const name = row[key] || "unknown";
    const current = groups.get(name) || { name, count: 0, wins: 0, netReturn: 0 };
    current.count += 1;
    current.wins += row.success ? 1 : 0;
    current.netReturn += row.netReturn;
    groups.set(name, current);
  }
  return [...groups.values()]
    .map((row) => ({
      ...row,
      winRate: row.count ? round((row.wins / row.count) * 100, 1) : 0,
      averageNetReturn: row.count ? round(row.netReturn / row.count, 4) : 0,
      netReturn: round(row.netReturn, 4)
    }))
    .sort((a, b) => b.count - a.count || b.winRate - a.winRate);
}

function calibrationBuckets(outcomes, signals) {
  const byId = new Map(signals.map((signal) => [signal.id, signal]));
  const buckets = [
    { name: "0-59", min: 0, max: 59, count: 0, wins: 0 },
    { name: "60-69", min: 60, max: 69, count: 0, wins: 0 },
    { name: "70-79", min: 70, max: 79, count: 0, wins: 0 },
    { name: "80-89", min: 80, max: 89, count: 0, wins: 0 },
    { name: "90-100", min: 90, max: 100, count: 0, wins: 0 }
  ];
  for (const outcome of outcomes) {
    const signal = byId.get(outcome.signalId);
    if (!signal) continue;
    const bucket = buckets.find((item) => signal.confidence >= item.min && signal.confidence <= item.max);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.wins += outcome.success ? 1 : 0;
  }
  return buckets.map((bucket) => ({
    name: bucket.name,
    count: bucket.count,
    winRate: bucket.count ? round((bucket.wins / bucket.count) * 100, 1) : 0
  }));
}

function buildSummary(signals, outcomes, created, evaluated, provider) {
  const pending = signals.length * horizons.length - outcomes.length;
  return {
    generatedAt: new Date().toISOString(),
    provider,
    totals: {
      signals: signals.length,
      newSignals: created.length,
      outcomes: outcomes.length,
      newOutcomes: evaluated.length,
      pendingOutcomes: Math.max(0, pending)
    },
    byModel: summarizeGroup(outcomes, "leadModel"),
    byRegime: summarizeGroup(outcomes, "regime"),
    bySymbol: summarizeGroup(outcomes, "symbol"),
    calibration: calibrationBuckets(outcomes, signals),
    nextActions: [
      "明日も同じ時刻に全対象のシグナルを保存する。",
      "4本後、8本後、16本後の答え合わせを増やす。",
      "30件以上たまったモデルから信頼度補正を強める。"
    ]
  };
}

function summaryMarkdown(summary) {
  const topModel = summary.byModel[0];
  return [
    "# Market AI Learning Summary",
    "",
    "## 結論",
    `今日の学習記録では、新規シグナル${summary.totals.newSignals}件、新規答え合わせ${summary.totals.newOutcomes}件を保存しました。`,
    "",
    "## 理由",
    `累計シグナルは${summary.totals.signals}件、累計答え合わせは${summary.totals.outcomes}件、未評価は${summary.totals.pendingOutcomes}件です。`,
    topModel ? `現時点で記録数が最も多いモデルは${topModel.name}で、${topModel.count}件です。` : "まだ答え合わせ済みのモデル成績はありません。",
    "",
    "## 次のアクション",
    ...summary.nextActions.map((item, index) => `${index + 1}. ${item}`),
    ""
  ].join("\n");
}

export async function runDailyLearning(options = {}) {
  const provider = options.provider || "demo";
  const learningDir = options.learningDir || defaultLearningDir;
  const date = options.date || isoDateJst();
  const signalsPath = join(learningDir, "signals.jsonl");
  const outcomesPath = join(learningDir, "outcomes.jsonl");
  const summaryPath = join(learningDir, "learning-summary.json");
  const summaryMdPath = join(learningDir, "learning-summary.md");

  await mkdir(learningDir, { recursive: true });
  const existingSignals = await readJsonl(signalsPath);
  const existingKeys = new Set(existingSignals.map(signalKey));
  const created = [];

  for (const asset of listAssets()) {
    const result = await analyzeSymbol(asset.symbol, { provider });
    if (!result.ok) continue;
    const record = buildSignalRecord(result, provider, date);
    if (!existingKeys.has(signalKey(record))) {
      created.push(record);
      existingKeys.add(signalKey(record));
    }
  }

  await appendJsonl(signalsPath, created);
  const allSignals = [...existingSignals, ...created];
  const existingOutcomes = await readJsonl(outcomesPath);
  const existingOutcomeKeys = new Set(existingOutcomes.map((outcome) => outcome.id));
  const evaluated = [];
  const candlesBySymbol = new Map();

  for (const signal of allSignals) {
    if (!candlesBySymbol.has(signal.symbol)) {
      candlesBySymbol.set(signal.symbol, await getCandles({ symbol: signal.symbol, provider: signal.provider }));
    }
    const { candles } = candlesBySymbol.get(signal.symbol);
    for (const horizon of horizons) {
      const key = outcomeKey(signal, horizon);
      if (existingOutcomeKeys.has(key)) continue;
      const outcome = evaluateSignal(signal, candles, horizon);
      if (outcome) {
        evaluated.push(outcome);
        existingOutcomeKeys.add(key);
      }
    }
  }

  await appendJsonl(outcomesPath, evaluated);
  const allOutcomes = [...existingOutcomes, ...evaluated];
  const summary = buildSummary(allSignals, allOutcomes, created, evaluated, provider);
  await writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(summaryMdPath, summaryMarkdown(summary), "utf8");
  return summary;
}

export async function readLearningSummary(options = {}) {
  const learningDir = options.learningDir || defaultLearningDir;
  try {
    return JSON.parse(await readFile(join(learningDir, "learning-summary.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        generatedAt: null,
        totals: { signals: 0, newSignals: 0, outcomes: 0, newOutcomes: 0, pendingOutcomes: 0 },
        byModel: [],
        byRegime: [],
        bySymbol: [],
        calibration: [],
        nextActions: ["日次学習を1回実行してください。"]
      };
    }
    throw error;
  }
}
