import { round } from "./indicators.js";

const DEFAULT_REQUIRED_BARS = 90;

function isValidCandle(candle) {
  return Number.isFinite(candle.open)
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low)
    && Number.isFinite(candle.close)
    && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close)
    && candle.close > 0;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreComponent(score, label, detail) {
  return {
    label,
    score: Math.round(clamp(score)),
    detail
  };
}

function expectedFreshnessHours(interval) {
  const map = {
    "1m": 2,
    "5m": 4,
    "15m": 8,
    "1h": 18,
    "4h": 42,
    "1d": 120
  };
  return map[interval] || 120;
}

function detectGaps(candles) {
  if (candles.length < 4) return 0;
  const gaps = [];
  for (let index = 1; index < candles.length; index += 1) {
    const previous = new Date(candles[index - 1].time).getTime();
    const current = new Date(candles[index].time).getTime();
    const gap = current - previous;
    if (Number.isFinite(gap) && gap > 0) gaps.push(gap);
  }
  if (gaps.length < 3) return 0;
  const sorted = [...gaps].sort((a, b) => a - b);
  const normalGap = sorted[Math.floor(sorted.length / 2)] || sorted[0];
  return gaps.filter((gap) => gap > normalGap * 3.5).length;
}

function detectOutliers(candles) {
  let outliers = 0;
  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1].close;
    const current = candles[index].close;
    if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0) continue;
    const move = Math.abs(current / previous - 1);
    if (move >= 0.2) outliers += 1;
  }
  return outliers;
}

function gradeFromScore(score) {
  if (score >= 90) return "高い";
  if (score >= 70) return "普通";
  if (score >= 50) return "低い";
  return "不可";
}

function decisionFromScore(score) {
  if (score >= 80) return "通常分析";
  if (score >= 60) return "注意付き分析";
  if (score >= 40) return "参考表示のみ";
  return "分析不可";
}

export function assessDataQuality(candles, source, options = {}) {
  const requiredBars = options.requiredBars || DEFAULT_REQUIRED_BARS;
  const interval = options.interval || "1d";
  const issues = [];
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      score: 0,
      grade: "不可",
      decision: "分析不可",
      issues: ["価格データが0本です。"],
      components: [
        scoreComponent(0, "取得", "価格データが取得できていません。"),
        scoreComponent(0, "本数", `必要${requiredBars}本に対して0本です。`)
      ],
      usable: false,
      bars: 0,
      invalidBars: 0,
      duplicateTimes: 0,
      timeOrderBreaks: 0,
      gapCount: 0,
      outlierBars: 0,
      zeroVolumeBars: 0,
      freshnessMinutes: null,
      staleHours: null,
      requiredBars,
      source,
      interval
    };
  }

  let invalidBars = 0;
  let duplicateTimes = 0;
  let timeOrderBreaks = 0;
  let zeroVolumeBars = 0;
  const seenTimes = new Set();

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!isValidCandle(candle)) invalidBars += 1;
    if ((candle.volume || 0) === 0) zeroVolumeBars += 1;
    if (seenTimes.has(candle.time)) duplicateTimes += 1;
    seenTimes.add(candle.time);
    if (index > 0 && new Date(candles[index - 1].time) > new Date(candle.time)) {
      timeOrderBreaks += 1;
    }
  }

  const lastTime = new Date(candles.at(-1).time).getTime();
  const staleHours = Number.isFinite(lastTime) ? (Date.now() - lastTime) / (60 * 60 * 1000) : null;
  const freshnessMinutes = staleHours === null ? null : staleHours * 60;
  const gapCount = detectGaps(candles);
  const outlierBars = detectOutliers(candles);
  const freshnessLimit = expectedFreshnessHours(interval);

  const fetchScore = candles.length > 0 ? 100 : 0;
  const barScore = clamp((candles.length / requiredBars) * 100);
  const freshnessScore = staleHours === null
    ? 35
    : clamp(100 - Math.max(0, staleHours - freshnessLimit) * 1.8);
  const shapeScore = clamp(100 - invalidBars * 18 - duplicateTimes * 8 - timeOrderBreaks * 35);
  const continuityScore = clamp(100 - gapCount * 12 - outlierBars * 18);
  const volumeScore = candles.length === 0 ? 0 : clamp(100 - (zeroVolumeBars / candles.length) * 80);

  let score = Math.round(
    fetchScore * 0.2
      + barScore * 0.25
      + freshnessScore * 0.2
      + shapeScore * 0.2
      + continuityScore * 0.1
      + volumeScore * 0.05
  );

  if (candles.length < requiredBars) {
    issues.push(`分析に必要な${requiredBars}本に対して${candles.length}本しかありません。`);
  }
  if (invalidBars > 0) {
    issues.push(`価格の形が壊れている足が${invalidBars}本あります。`);
  }
  if (duplicateTimes > 0) {
    issues.push(`同じ時刻の足が${duplicateTimes}本あります。`);
  }
  if (timeOrderBreaks > 0) {
    issues.push(`時系列の順番が崩れている場所が${timeOrderBreaks}件あります。`);
  }
  if (gapCount > 0) {
    issues.push(`時間の抜けが疑われる場所が${gapCount}件あります。`);
  }
  if (outlierBars > 0) {
    issues.push(`前の足から20%以上飛んだ足が${outlierBars}本あります。`);
  }
  if (source?.startsWith("free") && staleHours !== null && staleHours > freshnessLimit) {
    issues.push(`最新データが約${round(staleHours, 1)}時間前です。`);
  }

  score = Math.max(0, Math.round(score));
  const grade = gradeFromScore(score);
  const decision = decisionFromScore(score);
  if (issues.length === 0) issues.push("データの形に大きな問題はありません。");

  return {
    score,
    grade,
    decision,
    issues: issues.slice(0, 5),
    components: [
      scoreComponent(fetchScore, "取得", source ? `${source}から取得しました。` : "取得元は不明です。"),
      scoreComponent(barScore, "本数", `${candles.length}本 / 必要${requiredBars}本`),
      scoreComponent(freshnessScore, "新しさ", staleHours === null ? "最新時刻を確認できません。" : `最新は約${round(staleHours, 1)}時間前です。`),
      scoreComponent(shapeScore, "形", `壊れた足${invalidBars}本、重複${duplicateTimes}本、順序崩れ${timeOrderBreaks}件`),
      scoreComponent(continuityScore, "連続性", `時間抜け${gapCount}件、異常な飛び${outlierBars}本`),
      scoreComponent(volumeScore, "出来高", `出来高0の足${zeroVolumeBars}本`)
    ],
    usable: score >= 50 && candles.length >= requiredBars && invalidBars === 0 && timeOrderBreaks === 0,
    bars: candles.length,
    invalidBars,
    duplicateTimes,
    timeOrderBreaks,
    gapCount,
    outlierBars,
    zeroVolumeBars,
    freshnessMinutes: freshnessMinutes === null ? null : round(freshnessMinutes, 1),
    staleHours: staleHours === null ? null : round(staleHours, 1),
    requiredBars,
    source,
    interval
  };
}
