import { round } from "./indicators.js";

function isValidCandle(candle) {
  return Number.isFinite(candle.open)
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low)
    && Number.isFinite(candle.close)
    && candle.high >= Math.max(candle.open, candle.close)
    && candle.low <= Math.min(candle.open, candle.close)
    && candle.close > 0;
}

export function assessDataQuality(candles, source) {
  const issues = [];
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      score: 0,
      grade: "不可",
      issues: ["価格データが0本です。"],
      usable: false,
      bars: 0,
      invalidBars: 0,
      duplicateTimes: 0,
      staleHours: null,
      source
    };
  }

  let invalidBars = 0;
  let duplicateTimes = 0;
  let timeOrderBreaks = 0;
  const seenTimes = new Set();

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!isValidCandle(candle)) invalidBars += 1;
    if (seenTimes.has(candle.time)) duplicateTimes += 1;
    seenTimes.add(candle.time);
    if (index > 0 && new Date(candles[index - 1].time) > new Date(candle.time)) {
      timeOrderBreaks += 1;
    }
  }

  const lastTime = new Date(candles.at(-1).time).getTime();
  const staleHours = Number.isFinite(lastTime) ? (Date.now() - lastTime) / (60 * 60 * 1000) : null;
  let score = 100;

  if (candles.length < 90) {
    score -= 45;
    issues.push(`分析に必要な90本に対して${candles.length}本しかありません。`);
  }
  if (invalidBars > 0) {
    score -= Math.min(35, invalidBars * 8);
    issues.push(`価格の形が壊れている足が${invalidBars}本あります。`);
  }
  if (duplicateTimes > 0) {
    score -= Math.min(20, duplicateTimes * 4);
    issues.push(`同じ時刻の足が${duplicateTimes}本あります。`);
  }
  if (timeOrderBreaks > 0) {
    score -= 25;
    issues.push(`時系列の順番が崩れている場所が${timeOrderBreaks}件あります。`);
  }
  if (source === "free-stooq" && staleHours !== null && staleHours > 72) {
    score -= 10;
    issues.push(`最新データが約${round(staleHours, 1)}時間前です。`);
  }

  score = Math.max(0, Math.round(score));
  const grade = score >= 90 ? "高い" : score >= 70 ? "普通" : score >= 50 ? "低い" : "不可";
  if (issues.length === 0) issues.push("データの形に大きな問題はありません。");

  return {
    score,
    grade,
    issues: issues.slice(0, 5),
    usable: score >= 50 && candles.length >= 90,
    bars: candles.length,
    invalidBars,
    duplicateTimes,
    staleHours: staleHours === null ? null : round(staleHours, 1),
    source
  };
}
