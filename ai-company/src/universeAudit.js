import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSETS } from "./assets.js";
import { fetchFreeCandles, generateDemoCandles } from "./dataProvider.js";
import { assessDataQuality } from "./dataQuality.js";
import { latestFeatures, round } from "./indicators.js";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const defaultUniverseDir = join(rootDir, "data", "universe");

export const UNIVERSE_STATUS = {
  available: "取得可",
  insufficient: "不足",
  unavailable: "取得不可",
  sourceFailure: "通信失敗"
};

const GROUP_PRIORITY = {
  FX: 26,
  "貴金属": 25,
  "指数ETF": 23,
  "米国株": 21,
  "日本株": 19,
  "貴金属ETF・鉱山株": 18
};

function isoDateJst(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  for (const part of chunk(items, concurrency)) {
    const batch = await Promise.all(part.map(mapper));
    results.push(...batch);
  }
  return results;
}

function isSourceFailure(warning = "") {
  return /fetch failed|aborted|network|timeout|timed out|econn|enotfound|eai_again|etimedout|http 5\d\d|http 429/i.test(warning);
}

export function classifyDataStatus(candles, quality, warning) {
  if (!candles.length && isSourceFailure(warning)) return UNIVERSE_STATUS.sourceFailure;
  if (!candles.length) return UNIVERSE_STATUS.unavailable;
  if (!quality.usable) return UNIVERSE_STATUS.insufficient;
  return UNIVERSE_STATUS.available;
}

function priorityScore(asset, candles, quality) {
  const usableCandles = candles.length >= 90 ? candles : generateDemoCandles(asset.symbol);
  const features = latestFeatures(usableCandles);
  const atrPercent = features.atr14 && features.close ? (features.atr14 / features.close) * 100 : 0;
  const volumeScore = features.volumeRatio >= 0.7 ? 8 : 3;
  const dataScore = Math.min(30, quality.score * 0.3);
  const availabilityBonus = quality.usable ? 18 : candles.length > 0 ? 8 : 0;
  const volatilityScore = Math.min(14, atrPercent * 4);
  const groupScore = GROUP_PRIORITY[asset.group] || 15;
  return Math.round(dataScore + availabilityBonus + volatilityScore + volumeScore + groupScore);
}

function reasonFor(row) {
  const reasons = [];
  if (row.status === UNIVERSE_STATUS.sourceFailure) {
    reasons.push(`無料データ元に接続できず、実データ${row.bars}本`);
  } else {
    reasons.push(`${row.status}、データ${row.bars}本`);
  }
  reasons.push(`品質${row.qualityScore}/100`);
  reasons.push(`${row.group}の重要度を反映`);
  if (row.atrPercent !== null) reasons.push(`値動き${row.atrPercent}%`);
  return reasons.join(" / ");
}

async function auditAsset(asset, options = {}) {
  const fetchCandles = options.fetchCandles || fetchFreeCandles;
  const payload = options.useDemo
    ? { candles: generateDemoCandles(asset.symbol), source: "demo", warning: "デモデータで監査の形を確認しました。" }
    : await fetchCandles(asset.symbol);
  const { candles, warning } = payload;
  const source = options.useDemo ? "demo" : payload.source || "free-stooq";
  const quality = assessDataQuality(candles, source);
  const usableCandles = candles.length >= 20 ? candles : generateDemoCandles(asset.symbol);
  const features = latestFeatures(usableCandles);
  const row = {
    symbol: asset.symbol,
    name: asset.name,
    group: asset.group,
    dataSymbol: asset.dataSymbol,
    status: classifyDataStatus(candles, quality, warning),
    bars: candles.length,
    qualityScore: quality.score,
    qualityGrade: quality.grade,
    usable: quality.usable,
    latestTime: candles.at(-1)?.time ?? null,
    close: round(features.close, features.close < 2 ? 5 : 3),
    atrPercent: round(features.atr14 && features.close ? (features.atr14 / features.close) * 100 : 0, 2),
    volumeRatio: round(features.volumeRatio, 2),
    priorityScore: 0,
    warning
  };
  row.priorityScore = priorityScore(asset, candles, quality);
  row.reason = reasonFor(row);
  return row;
}

function summarize(rows) {
  const byStatus = Object.groupBy(rows, (row) => row.status);
  const byGroup = Object.groupBy(rows, (row) => row.group);
  return {
    total: rows.length,
    available: byStatus[UNIVERSE_STATUS.available]?.length || 0,
    insufficient: byStatus[UNIVERSE_STATUS.insufficient]?.length || 0,
    unavailable: byStatus[UNIVERSE_STATUS.unavailable]?.length || 0,
    sourceFailures: byStatus[UNIVERSE_STATUS.sourceFailure]?.length || 0,
    byGroup: Object.fromEntries(Object.entries(byGroup).map(([group, items]) => [
      group,
      {
        total: items.length,
        available: items.filter((row) => row.status === UNIVERSE_STATUS.available).length,
        insufficient: items.filter((row) => row.status === UNIVERSE_STATUS.insufficient).length,
        unavailable: items.filter((row) => row.status === UNIVERSE_STATUS.unavailable).length,
        sourceFailures: items.filter((row) => row.status === UNIVERSE_STATUS.sourceFailure).length,
        averagePriority: round(items.reduce((sum, row) => sum + row.priorityScore, 0) / items.length, 1)
      }
    ])),
    topPriority: rows.slice(0, 20).map((row) => ({
      symbol: row.symbol,
      group: row.group,
      status: row.status,
      priorityScore: row.priorityScore
    }))
  };
}

function markdownReport(result) {
  const lines = [
    "# Market AI Universe Audit",
    "",
    "## 結論",
    `監視対象${result.summary.total}件のうち、無料データ取得可は${result.summary.available}件、不足は${result.summary.insufficient}件、取得不可は${result.summary.unavailable}件、通信失敗は${result.summary.sourceFailures}件です。`,
    "",
    "## 理由",
    "無料データの取得可否、データ本数、品質、資産分類、値動きを使って監視優先度を出しました。通信失敗は、銘柄が未対応という意味ではなく、この実行環境から無料データ元に接続できなかった状態として分けています。",
    "",
    "## 分類別",
    "|分類|対象数|取得可|不足|取得不可|通信失敗|平均優先度|",
    "|---|---:|---:|---:|---:|---:|---:|"
  ];
  Object.entries(result.summary.byGroup).forEach(([group, item]) => {
    lines.push(`|${group}|${item.total}|${item.available}|${item.insufficient}|${item.unavailable}|${item.sourceFailures}|${item.averagePriority}|`);
  });
  lines.push(
    "",
    "## 上位20件",
    "|順位|対象|分類|状態|優先度|理由|",
    "|---:|---|---|---|---:|---|"
  );
  result.rows.slice(0, 20).forEach((row, index) => {
    lines.push(`|${index + 1}|${row.symbol}|${row.group}|${row.status}|${row.priorityScore}|${row.reason}|`);
  });
  lines.push("", "## 次のアクション");
  lines.push("1. 通信失敗が0件になるまで、無料データ元を2つ以上に増やす。");
  lines.push("2. 取得可になった対象から、毎日の学習データに実データを保存する。");
  lines.push("3. 取得できない対象は推測せず、画面では「分析不可」と表示する。");
  return `${lines.join("\n")}\n`;
}

export async function auditUniverse(options = {}) {
  const outputDir = options.outputDir || defaultUniverseDir;
  const date = options.date || isoDateJst();
  const concurrency = options.concurrency || 8;
  await mkdir(outputDir, { recursive: true });
  const rows = await mapWithConcurrency(ASSETS, concurrency, (asset) => auditAsset(asset, options));
  rows.sort((a, b) => b.priorityScore - a.priorityScore || a.symbol.localeCompare(b.symbol));
  const result = {
    generatedAt: new Date().toISOString(),
    date,
    source: options.useDemo ? "demo" : "free-stooq",
    summary: summarize(rows),
    rows
  };
  await writeFile(join(outputDir, `universe-audit-${date}.json`), JSON.stringify(result, null, 2), "utf8");
  await writeFile(join(outputDir, "latest-universe-audit.json"), JSON.stringify(result, null, 2), "utf8");
  await writeFile(join(outputDir, `universe-audit-${date}.md`), markdownReport(result), "utf8");
  await writeFile(join(outputDir, "latest-universe-audit.md"), markdownReport(result), "utf8");
  return result;
}
