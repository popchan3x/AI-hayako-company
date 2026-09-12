import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSymbol, listAssets } from "./analyzer.js";
import { getCandles } from "./dataProvider.js";
import { normalizeTimeframe } from "./dataProvider.js";
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
  return signalKeyFor(record.date, record.provider, record.interval, record.symbol);
}

function signalKeyFor(date, provider, interval, symbol) {
  return `${date}|${provider}|${interval}|${symbol}`;
}

function outcomeKey(signal, horizon) {
  return `${signal.id}|${horizon}`;
}

function outcomeRecordKey(record) {
  if (record.id) return record.id;
  if (record.signalId && record.horizon) return `${record.signalId}|${record.horizon}`;
  return null;
}

function uniqueByKey(rows, keyFn) {
  const byKey = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    byKey.set(key, row);
  }
  return [...byKey.values()];
}

function pendingOutcomeCount(signals, outcomes) {
  const outcomeKeys = new Set(outcomes.map(outcomeRecordKey).filter(Boolean));
  let pending = 0;
  for (const signal of signals) {
    for (const horizon of horizons) {
      if (!outcomeKeys.has(outcomeKey(signal, horizon))) pending += 1;
    }
  }
  return pending;
}

function buildSignalRecord(result, provider, date, interval) {
  const signal = result.signal;
  return {
    id: `${date}-${provider}-${interval}-${result.symbol}`,
    date,
    generatedAt: result.generatedAt,
    provider,
    interval,
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
    modelScores: result.tournament.map((entry) => ({
      name: entry.name,
      direction: entry.direction,
      confidence: entry.confidence,
      winRate: entry.winRate,
      profitFactor: entry.profitFactor,
      netReturn: entry.netReturn,
      maxDrawdown: entry.maxDrawdown,
      score: entry.score
    })),
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
    interval: signal.interval,
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
    { name: "0-59", min: 0, max: 59, count: 0, wins: 0, netReturn: 0 },
    { name: "60-69", min: 60, max: 69, count: 0, wins: 0, netReturn: 0 },
    { name: "70-79", min: 70, max: 79, count: 0, wins: 0, netReturn: 0 },
    { name: "80-89", min: 80, max: 89, count: 0, wins: 0, netReturn: 0 },
    { name: "90-100", min: 90, max: 100, count: 0, wins: 0, netReturn: 0 }
  ];
  for (const outcome of outcomes) {
    const signal = byId.get(outcome.signalId);
    if (!signal) continue;
    const bucket = buckets.find((item) => signal.confidence >= item.min && signal.confidence <= item.max);
    if (!bucket) continue;
    bucket.count += 1;
    bucket.wins += outcome.success ? 1 : 0;
    bucket.netReturn += Number(outcome.netReturn) || 0;
  }
  return buckets.map((bucket) => ({
    name: bucket.name,
    count: bucket.count,
    wins: bucket.wins,
    winRate: bucket.count ? round((bucket.wins / bucket.count) * 100, 1) : 0,
    netReturn: round(bucket.netReturn, 4),
    averageNetReturn: bucket.count ? round(bucket.netReturn / bucket.count, 4) : 0,
    status: bucketStatus(bucket)
  }));
}

function bucketStatus(bucket) {
  if (bucket.count < 30) return "データ不足";
  const winRate = (bucket.wins / bucket.count) * 100;
  const averageNetReturn = bucket.netReturn / bucket.count;
  if (averageNetReturn > 0 && winRate >= 55) return "良好";
  if (averageNetReturn > 0) return "利益あり";
  if (winRate >= 70) return "勝率高いが損益注意";
  return "要改善";
}

function confidenceHealth(calibration) {
  const low = calibration.find((bucket) => bucket.name === "0-59");
  const high = calibration.find((bucket) => bucket.name === "90-100");
  const lowReady = (low?.count || 0) >= 30;
  const highReady = (high?.count || 0) >= 30;
  const inverted = lowReady && highReady && high.winRate + 5 < low.winRate;
  const negativeHigh = highReady && high.averageNetReturn <= 0;
  const status = inverted || negativeHigh ? "要修正" : "通常";
  const summary = status === "要修正"
    ? `信頼度90以上は${high.count}件で勝率${high.winRate}%、平均損益${high.averageNetReturn}%です。信頼度0-59の${low.winRate}%より弱いため、強い候補の表示を抑えます。`
    : highReady
      ? `信頼度90以上は${high.count}件で勝率${high.winRate}%、平均損益${high.averageNetReturn}%です。`
      : "信頼度90以上の答え合わせが30件未満のため、まだ強弱を決めません。";
  return {
    status,
    summary,
    highConfidence: high || null,
    lowConfidence: low || null,
    inverted,
    negativeHigh
  };
}

function buildSummary(signals, outcomes, created, evaluated, provider, intervals, options = {}) {
  const uniqueSignals = uniqueByKey(signals, signalKey);
  const uniqueOutcomes = uniqueByKey(outcomes, outcomeRecordKey);
  const pending = pendingOutcomeCount(uniqueSignals, uniqueOutcomes);
  const calibration = calibrationBuckets(uniqueOutcomes, uniqueSignals);
  const health = confidenceHealth(calibration);
  const runTotals = options.runTotals || {};
  return {
    generatedAt: new Date().toISOString(),
    provider,
    intervals,
    runScope: options.runScope || (intervals.length > 1 ? "複数時間足の合算" : `${intervals[0]}のみ`),
    totals: {
      signals: signals.length,
      uniqueSignals: uniqueSignals.length,
      duplicateSignals: Math.max(0, signals.length - uniqueSignals.length),
      newSignals: runTotals.newSignals ?? created.length,
      outcomes: outcomes.length,
      uniqueOutcomes: uniqueOutcomes.length,
      duplicateOutcomes: Math.max(0, outcomes.length - uniqueOutcomes.length),
      newOutcomes: runTotals.newOutcomes ?? evaluated.length,
      expectedOutcomes: uniqueSignals.length * horizons.length,
      pendingOutcomes: Math.max(0, pending)
    },
    byModel: summarizeGroup(uniqueOutcomes, "leadModel"),
    byRegime: summarizeGroup(uniqueOutcomes, "regime"),
    byTimeframe: summarizeGroup(uniqueOutcomes, "interval"),
    bySymbol: summarizeGroup(uniqueOutcomes, "symbol"),
    calibration,
    confidenceHealth: health,
    nextActions: [
      health.status === "要修正"
        ? "信頼度90以上でも平均損益が0%以下なら、強い候補として扱わない。"
        : "信頼度90以上の答え合わせを30件以上たまるまで増やす。",
      "モデル別の平均損益が0%未満の間は、見送り判定を強める。",
      "明日も9:00以降に6種類の時間足で学習し、4本後、8本後、16本後の答え合わせを保存する。"
    ]
  };
}

async function writeLearningSummary(paths, signals, outcomes, created, evaluated, provider, intervals, options = {}) {
  const summary = buildSummary(signals, outcomes, created, evaluated, provider, intervals, options);
  await writeFile(paths.summaryPath, JSON.stringify(summary, null, 2), "utf8");
  await writeFile(paths.summaryMdPath, summaryMarkdown(summary), "utf8");
  return summary;
}

function summaryMarkdown(summary) {
  const topModel = summary.byModel[0];
  const topTimeframe = summary.byTimeframe?.[0];
  return [
    "# Market AI Learning Summary",
    "",
    "## 結論",
    `今日の学習記録では、新規シグナル${summary.totals.newSignals}件、新規答え合わせ${summary.totals.newOutcomes}件を保存しました。`,
    "",
    "## 理由",
    `集計範囲は${summary.runScope}です。累計シグナルは${summary.totals.signals}件、一意のシグナルは${summary.totals.uniqueSignals}件、累計答え合わせは${summary.totals.outcomes}件、未評価は${summary.totals.pendingOutcomes}件です。`,
    topModel ? `現時点で記録数が最も多いモデルは${topModel.name}で、${topModel.count}件です。` : "まだ答え合わせ済みのモデル成績はありません。",
    topTimeframe ? `現時点で記録数が最も多い時間足は${topTimeframe.name}で、${topTimeframe.count}件です。` : "まだ時間足別の答え合わせはありません。",
    summary.confidenceHealth ? `信頼度点検: ${summary.confidenceHealth.summary}` : "信頼度点検はまだありません。",
    "",
    "## 次のアクション",
    ...summary.nextActions.map((item, index) => `${index + 1}. ${item}`),
    ""
  ].join("\n");
}

export async function runDailyLearning(options = {}) {
  const provider = options.provider || "demo";
  const intervals = (options.intervals?.length ? options.intervals : ["1d"]).map(normalizeTimeframe);
  const stage = options.stage || "all";
  if (!["all", "signals", "outcomes"].includes(stage)) {
    throw new Error(`Unsupported learning stage: ${stage}`);
  }
  const learningDir = options.learningDir || defaultLearningDir;
  const date = options.date || isoDateJst();
  const paths = {
    signalsPath: join(learningDir, "signals.jsonl"),
    outcomesPath: join(learningDir, "outcomes.jsonl"),
    summaryPath: join(learningDir, "learning-summary.json"),
    summaryMdPath: join(learningDir, "learning-summary.md")
  };

  await mkdir(learningDir, { recursive: true });
  const existingSignals = await readJsonl(paths.signalsPath);
  const existingKeys = new Set(existingSignals.map(signalKey));
  const created = [];

  if (stage !== "outcomes") {
    for (const interval of intervals) {
      for (const asset of listAssets()) {
        const expectedKey = signalKeyFor(date, provider, interval, asset.symbol);
        if (existingKeys.has(expectedKey)) continue;
        const result = await analyzeSymbol(asset.symbol, { provider, interval });
        if (!result.ok) continue;
        const record = buildSignalRecord(result, provider, date, interval);
        if (!existingKeys.has(signalKey(record))) {
          created.push(record);
          existingKeys.add(signalKey(record));
        }
      }
    }

    await appendJsonl(paths.signalsPath, created);
  }

  const allSignals = [...existingSignals, ...created];
  const existingOutcomes = await readJsonl(paths.outcomesPath);

  if (stage === "signals") {
    return writeLearningSummary(paths, allSignals, existingOutcomes, created, [], provider, intervals);
  }

  await writeLearningSummary(paths, allSignals, existingOutcomes, created, [], provider, intervals);

  const existingOutcomeKeys = new Set(existingOutcomes.map((outcome) => outcome.id));
  const evaluated = [];
  const candlesBySymbol = new Map();
  const intervalSet = new Set(intervals);

  for (const signal of allSignals) {
    const interval = normalizeTimeframe(signal.interval || "1d");
    if (!intervalSet.has(interval)) continue;
    const pendingHorizons = horizons.filter((horizon) => !existingOutcomeKeys.has(outcomeKey(signal, horizon)));
    if (pendingHorizons.length === 0) continue;
    const candleKey = `${signal.symbol}|${signal.provider}|${interval}`;
    if (!candlesBySymbol.has(candleKey)) {
      candlesBySymbol.set(candleKey, await getCandles({ symbol: signal.symbol, provider: signal.provider, interval }));
    }
    const { candles } = candlesBySymbol.get(candleKey);
    const currentEvaluated = [];
    for (const horizon of pendingHorizons) {
      const outcome = evaluateSignal(signal, candles, horizon);
      if (outcome) {
        currentEvaluated.push(outcome);
        existingOutcomeKeys.add(outcome.id);
      }
    }
    await appendJsonl(paths.outcomesPath, currentEvaluated);
    evaluated.push(...currentEvaluated);
  }

  const allOutcomes = [...existingOutcomes, ...evaluated];
  return writeLearningSummary(paths, allSignals, allOutcomes, created, evaluated, provider, intervals);
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
        intervals: [],
        byModel: [],
        byRegime: [],
        byTimeframe: [],
        bySymbol: [],
        calibration: [],
        confidenceHealth: {
          status: "未実行",
          summary: "学習記録がまだありません。",
          highConfidence: null,
          lowConfidence: null,
          inverted: false,
          negativeHigh: false
        },
        nextActions: ["日次学習を1回実行してください。"]
      };
    }
    throw error;
  }
}

export async function rebuildLearningSummary(options = {}) {
  const learningDir = options.learningDir || defaultLearningDir;
  const paths = {
    signalsPath: join(learningDir, "signals.jsonl"),
    outcomesPath: join(learningDir, "outcomes.jsonl"),
    summaryPath: join(learningDir, "learning-summary.json"),
    summaryMdPath: join(learningDir, "learning-summary.md")
  };
  const signals = await readJsonl(paths.signalsPath);
  const outcomes = await readJsonl(paths.outcomesPath);
  const intervals = (options.intervals?.length ? options.intervals : ["1m", "5m", "15m", "1h", "4h", "1d"])
    .map(normalizeTimeframe);
  return writeLearningSummary(
    paths,
    signals,
    outcomes,
    [],
    [],
    options.provider || "combined",
    intervals,
    {
      runTotals: options.runTotals,
      runScope: options.runScope || "保存済み全データの再集計"
    }
  );
}
