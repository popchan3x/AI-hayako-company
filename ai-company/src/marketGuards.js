import { getCandles, normalizeTimeframe, TIMEFRAMES } from "./dataProvider.js";
import { latestFeatures, round } from "./indicators.js";
import { assessDataQuality } from "./dataQuality.js";

const MARKET_WINDOWS = [
  {
    id: "tokyo-pre-data",
    label: "日本の主要統計が出やすい時間",
    hour: 8,
    minute: 50,
    before: 20,
    after: 20,
    severity: "中",
    groups: ["FX", "日本株", "指数ETF"],
    currencies: ["JPY"],
    note: "円、日経平均、日本株の短期変動に注意します。"
  },
  {
    id: "tokyo-open",
    label: "東京市場開始",
    hour: 9,
    minute: 0,
    before: 15,
    after: 30,
    severity: "中",
    groups: ["日本株", "指数ETF", "FX"],
    currencies: ["JPY"],
    note: "寄り付き直後は価格が飛びやすい時間です。"
  },
  {
    id: "tokyo-close",
    label: "東京市場引け",
    hour: 15,
    minute: 0,
    before: 20,
    after: 15,
    severity: "低",
    groups: ["日本株", "指数ETF", "FX"],
    currencies: ["JPY"],
    note: "引け前後の需給で短期の動きが変わることがあります。"
  },
  {
    id: "london-open",
    label: "ロンドン市場開始",
    hour: 16,
    minute: 0,
    before: 20,
    after: 35,
    severity: "中",
    groups: ["FX", "貴金属"],
    currencies: ["EUR", "GBP", "CHF"],
    note: "欧州勢の参加でFXと貴金属の値動きが変わりやすい時間です。"
  },
  {
    id: "us-data",
    label: "米国主要指標が出やすい時間",
    hour: 21,
    minute: 30,
    before: 60,
    after: 45,
    severity: "高",
    groups: ["FX", "貴金属", "米国株", "指数ETF", "貴金属ETF・鉱山株"],
    currencies: ["USD", "CAD"],
    note: "CPI、雇用、小売などで急変しやすい時間帯として警戒します。"
  },
  {
    id: "us-open",
    label: "米国株式市場開始",
    hour: 22,
    minute: 30,
    before: 20,
    after: 45,
    severity: "中",
    groups: ["米国株", "指数ETF", "貴金属ETF・鉱山株", "FX", "貴金属"],
    currencies: ["USD"],
    note: "米国株の寄り付きで指数、ドル、金が動きやすい時間です。"
  },
  {
    id: "us-secondary-data",
    label: "米国追加指標が出やすい時間",
    hour: 23,
    minute: 0,
    before: 20,
    after: 30,
    severity: "中",
    groups: ["FX", "貴金属", "米国株", "指数ETF"],
    currencies: ["USD"],
    note: "ISMや住宅関連などの発表時間として警戒します。"
  },
  {
    id: "fomc-window",
    label: "FOMCやFRB発表が出やすい時間",
    hour: 3,
    minute: 0,
    before: 60,
    after: 60,
    severity: "高",
    groups: ["FX", "貴金属", "米国株", "指数ETF", "日本株", "貴金属ETF・鉱山株"],
    currencies: ["USD", "JPY", "EUR", "GBP", "AUD", "CAD", "CHF"],
    note: "金利とドルが大きく動きやすいため、見送りを強めます。"
  }
];

const CONTEXT_MAP = {
  metals: [
    { symbol: "EURUSD", role: "ドルの弱さ", relation: "same", weight: 11 },
    { symbol: "USDJPY", role: "ドル円", relation: "inverse", weight: 8 },
    { symbol: "TLT", role: "米金利低下の代理", relation: "same", weight: 11 },
    { symbol: "SLV", role: "銀", relation: "same", weight: 12 },
    { symbol: "GDX", role: "金鉱株", relation: "same", weight: 10 },
    { symbol: "VIXY", role: "不安心理", relation: "caution", weight: 6 }
  ],
  fxUsdBase: [
    { symbol: "EURUSD", role: "ドルの弱さ", relation: "inverse", weight: 12 },
    { symbol: "TLT", role: "米金利低下の代理", relation: "inverse", weight: 8 },
    { symbol: "SPY", role: "米国株", relation: "same", weight: 7 },
    { symbol: "VIXY", role: "不安心理", relation: "caution", weight: 6 }
  ],
  fxUsdQuote: [
    { symbol: "EURUSD", role: "ドルの弱さ", relation: "same", weight: 12 },
    { symbol: "USDJPY", role: "ドル円", relation: "inverse", weight: 9 },
    { symbol: "TLT", role: "米金利低下の代理", relation: "same", weight: 8 },
    { symbol: "SPY", role: "米国株", relation: "same", weight: 6 }
  ],
  usEquity: [
    { symbol: "SPY", role: "米国株全体", relation: "same", weight: 13 },
    { symbol: "QQQ", role: "米ハイテク株", relation: "same", weight: 11 },
    { symbol: "HYG", role: "信用リスク", relation: "same", weight: 8 },
    { symbol: "VIXY", role: "不安心理", relation: "inverse", weight: 10 },
    { symbol: "TLT", role: "金利低下の代理", relation: "same", weight: 6 }
  ],
  japanEquity: [
    { symbol: "1321JP", role: "日経平均", relation: "same", weight: 13 },
    { symbol: "1306JP", role: "TOPIX", relation: "same", weight: 11 },
    { symbol: "USDJPY", role: "ドル円", relation: "same", weight: 7 },
    { symbol: "SPY", role: "米国株", relation: "same", weight: 6 },
    { symbol: "VIXY", role: "不安心理", relation: "inverse", weight: 8 }
  ],
  preciousEquity: [
    { symbol: "XAUUSD", role: "金本体", relation: "same", weight: 12 },
    { symbol: "GLD", role: "金ETF", relation: "same", weight: 10 },
    { symbol: "SLV", role: "銀ETF", relation: "same", weight: 8 },
    { symbol: "GDX", role: "金鉱株", relation: "same", weight: 10 },
    { symbol: "EURUSD", role: "ドルの弱さ", relation: "same", weight: 8 }
  ],
  index: [
    { symbol: "SPY", role: "米国株全体", relation: "same", weight: 12 },
    { symbol: "QQQ", role: "米ハイテク株", relation: "same", weight: 10 },
    { symbol: "DIA", role: "米大型株", relation: "same", weight: 8 },
    { symbol: "HYG", role: "信用リスク", relation: "same", weight: 7 },
    { symbol: "VIXY", role: "不安心理", relation: "inverse", weight: 10 }
  ]
};

const MAJOR_CURRENCIES = [
  { code: "USD", name: "米ドル" },
  { code: "EUR", name: "ユーロ" },
  { code: "JPY", name: "日本円" },
  { code: "GBP", name: "ポンド" },
  { code: "AUD", name: "豪ドル" },
  { code: "CAD", name: "カナダドル" },
  { code: "CHF", name: "スイスフラン" }
];

const MAJOR_FX_PAIRS = [
  "EURUSD",
  "USDJPY",
  "GBPUSD",
  "AUDUSD",
  "USDCAD",
  "USDCHF",
  "EURJPY",
  "EURGBP",
  "EURAUD",
  "EURCAD",
  "EURCHF",
  "GBPJPY",
  "GBPAUD",
  "GBPCAD",
  "GBPCHF",
  "AUDJPY",
  "AUDCAD",
  "AUDCHF",
  "CADJPY",
  "CADCHF",
  "CHFJPY"
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function currencyParts(symbol) {
  if (!/^[A-Z]{6}$/.test(symbol)) return [];
  return [symbol.slice(0, 3), symbol.slice(3, 6)];
}

function eventAppliesToAsset(event, asset) {
  if (event.groups.includes(asset.group)) return true;
  const currencies = currencyParts(asset.symbol);
  return currencies.some((currency) => event.currencies.includes(currency));
}

function jstParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour === "24" ? 0 : parts.hour);
  return {
    weekday: parts.weekday,
    minutes: hour * 60 + Number(parts.minute)
  };
}

function closestMinuteDistance(nowMinutes, eventMinutes) {
  const sameDay = eventMinutes - nowMinutes;
  const previousDay = sameDay - 1440;
  const nextDay = sameDay + 1440;
  return [sameDay, previousDay, nextDay].sort((a, b) => Math.abs(a) - Math.abs(b))[0];
}

function severityPenalty(severity) {
  if (severity === "高") return 40;
  if (severity === "中") return 25;
  return 14;
}

export function buildImportantEventFilter(asset, options = {}) {
  const now = options.now || new Date();
  const { weekday, minutes } = jstParts(now);
  const relevant = MARKET_WINDOWS
    .filter((event) => eventAppliesToAsset(event, asset))
    .map((event) => {
      const eventMinutes = event.hour * 60 + event.minute;
      const minutesToEvent = closestMinuteDistance(minutes, eventMinutes);
      const active = minutesToEvent <= event.before && minutesToEvent >= -event.after;
      const soon = minutesToEvent > event.before && minutesToEvent <= 180;
      return {
        ...event,
        minutesToEvent,
        active,
        soon
      };
    })
    .sort((a, b) => Math.abs(a.minutesToEvent) - Math.abs(b.minutesToEvent));

  const activeEvents = relevant.filter((event) => event.active);
  const upcomingEvents = relevant.filter((event) => event.soon).slice(0, 3);
  const weekend = weekday === "Sat" || weekday === "Sun";
  let score = 100;
  const warnings = [];

  for (const event of activeEvents) {
    score -= severityPenalty(event.severity);
    warnings.push(`${event.label}の警戒時間内です。${event.note}`);
  }
  if (activeEvents.length === 0 && upcomingEvents.length > 0) {
    const nearest = upcomingEvents[0];
    score -= nearest.severity === "高" ? 18 : 10;
    warnings.push(`${nearest.label}まで約${nearest.minutesToEvent}分です。`);
  }
  if (weekend) {
    score -= asset.group === "FX" || asset.group === "貴金属" ? 20 : 12;
    warnings.push("週末のため、通常よりデータ遅延や薄い値動きに注意します。");
  }

  score = Math.round(clamp(score));
  const status = score <= 60 ? "見送り優先" : score < 80 ? "警戒" : "通常";
  const confidenceAdjustment = score <= 60 ? -28 : score < 80 ? -12 : 0;

  return {
    score,
    status,
    confidenceAdjustment,
    tradeMode: status,
    activeEvents: activeEvents.map((event) => ({
      id: event.id,
      label: event.label,
      severity: event.severity,
      minutesToEvent: event.minutesToEvent,
      note: event.note
    })),
    upcomingEvents: upcomingEvents.map((event) => ({
      id: event.id,
      label: event.label,
      severity: event.severity,
      minutesToEvent: event.minutesToEvent,
      note: event.note
    })),
    warnings: warnings.length ? warnings.slice(0, 4) : ["直近180分以内の定例警戒時間はありません。"],
    checkedAt: now.toISOString(),
    timezone: "Asia/Tokyo",
    calendarStatus: "定例時間ベース。実際の経済指標カレンダーは未接続です。"
  };
}

function contextPlan(asset) {
  const symbol = asset.symbol;
  if (asset.group === "貴金属") return CONTEXT_MAP.metals;
  if (asset.group === "貴金属ETF・鉱山株") return CONTEXT_MAP.preciousEquity;
  if (asset.group === "米国株") return CONTEXT_MAP.usEquity;
  if (asset.group === "日本株") return CONTEXT_MAP.japanEquity;
  if (asset.group === "指数ETF") return symbol.endsWith("JP") || ["EWJ", "DXJ"].includes(symbol)
    ? CONTEXT_MAP.japanEquity
    : CONTEXT_MAP.index;
  if (asset.group === "FX") {
    if (symbol.startsWith("USD")) return CONTEXT_MAP.fxUsdBase;
    if (symbol.endsWith("USD")) return CONTEXT_MAP.fxUsdQuote;
    return [
      ...CONTEXT_MAP.fxUsdQuote.slice(0, 3),
      { symbol: "USDJPY", role: "円の強さ", relation: symbol.endsWith("JPY") ? "inverse" : "caution", weight: 7 }
    ];
  }
  return CONTEXT_MAP.index;
}

function trendDirection(features) {
  const slopePercent = features.slope24 && features.close ? features.slope24 / features.close : 0;
  const maBias = features.sma20 && features.sma50
    ? (features.sma20 - features.sma50) / Math.max(features.close, 0.0001)
    : 0;
  const combined = slopePercent * 0.65 + maBias * 0.35;
  if (combined > 0.00008) return { value: 1, label: "上向き", strength: combined };
  if (combined < -0.00008) return { value: -1, label: "下向き", strength: combined };
  return { value: 0, label: "横ばい", strength: combined };
}

function describePairMove(symbol, trend) {
  const parts = currencyParts(symbol);
  if (parts.length === 2) {
    const [base, quote] = parts;
    if (trend.value > 0) return `${base}が${quote}より強い`;
    if (trend.value < 0) return `${quote}が${base}より強い`;
    return `${base}と${quote}は横ばい`;
  }
  if (trend.value > 0) return `${symbol}が上向き`;
  if (trend.value < 0) return `${symbol}が下向き`;
  return `${symbol}は横ばい`;
}

function expectedValue(direction, relation) {
  if (direction === "見送り" || relation === "caution") return 0;
  const base = direction === "買い" ? 1 : -1;
  return relation === "inverse" ? -base : base;
}

function alignmentLabel(actual, expected, relation) {
  if (relation === "caution") return actual === 0 ? "中立" : "注意";
  if (actual === 0 || expected === 0) return "中立";
  if (actual === expected) return "追い風";
  if (actual === -expected) return "逆風";
  return "中立";
}

function expectedMoveLabel(targetDirection, relation) {
  if (relation === "caution" || targetDirection === "見送り") return "注意材料";
  const expected = expectedValue(targetDirection, relation);
  if (expected > 0) return "上向きなら味方";
  if (expected < 0) return "下向きなら味方";
  return "中立";
}

function relationLabel(relation) {
  if (relation === "inverse") return "逆に動きやすい";
  if (relation === "caution") return "荒さの注意材料";
  return "同じ方向に動きやすい";
}

function becausePhrase(meaning) {
  if (/上向き$|下向き$|横ばい$/.test(meaning)) return `${meaning}のため`;
  return `${meaning}ため`;
}

function impactText({ asset, targetDirection, driver, alignment, meaning }) {
  if (alignment === "取得不可") return `${driver.symbol}を確認できないため、判断材料から外しています。`;
  const because = becausePhrase(meaning);
  if (driver.relation === "caution") {
    if (driver.actualValue === 0) return `${because}、今回は大きな注意材料ではありません。`;
    return `${because}、値動きが荒くなる可能性を注意点に入れます。`;
  }
  if (alignment === "追い風") {
    return `${because}、${asset.symbol}の${targetDirection}判断を支えます。`;
  }
  if (alignment === "逆風") {
    return `${because}、${asset.symbol}の${targetDirection}判断とは逆向きの材料です。`;
  }
  return `${because}、今回は強い味方にも逆風にもしていません。`;
}

async function loadDriver(entry, provider, interval) {
  try {
    const result = await getCandles({ symbol: entry.symbol, provider, interval });
    const quality = assessDataQuality(result.candles, result.source, { interval });
    if (!quality.usable) {
      return {
        ...entry,
        available: false,
        alignment: "取得不可",
        actualMove: "-",
        quality,
        detail: quality.issues[0] || result.warning || "関連データを確認できません。"
      };
    }
    const features = latestFeatures(result.candles);
    const trend = trendDirection(features);
    return {
      ...entry,
      available: true,
      actualValue: trend.value,
      actualMove: trend.label,
      moveMeaning: describePairMove(entry.symbol, trend),
      trendStrength: round(Math.abs(trend.strength) * 10000, 3),
      latestClose: round(features.close, 4),
      quality,
      detail: `${entry.role}は${trend.label}です。品質${quality.score}/100。`
    };
  } catch (error) {
    return {
      ...entry,
      available: false,
      alignment: "取得不可",
      actualMove: "-",
      detail: `関連データ取得に失敗しました: ${error.message}`
    };
  }
}

function summarizeMap(score, supportCount, headwindCount, unavailableCount) {
  if (unavailableCount > 0 && supportCount + headwindCount === 0) {
    return "関連市場を十分に確認できないため、市場連動は参考扱いです。";
  }
  if (score >= 70) return `周辺市場は追い風が優勢です。追い風${supportCount}件、逆風${headwindCount}件。`;
  if (score <= 40) return `周辺市場は逆風が目立ちます。追い風${supportCount}件、逆風${headwindCount}件。`;
  return `周辺市場は強い偏りがありません。追い風${supportCount}件、逆風${headwindCount}件。`;
}

export async function buildMarketLinkageMap({ asset, targetDirection, provider, interval, includeContext = true }) {
  const timeframe = normalizeTimeframe(interval);
  const plan = contextPlan(asset)
    .filter((entry) => entry.symbol !== asset.symbol)
    .slice(0, 6);

  if (!includeContext || targetDirection === "見送り") {
    return {
      score: 50,
      status: "参考",
      confidenceAdjustment: 0,
      summary: targetDirection === "見送り"
        ? "主判断が見送りのため、市場連動は次の候補探し用に使います。"
        : "全体スキャンでは速度を優先し、市場連動の深掘りは個別分析で行います。",
      supportCount: 0,
      headwindCount: 0,
      neutralCount: plan.length,
      unavailableCount: 0,
      drivers: plan.map((entry) => ({
        symbol: entry.symbol,
        role: entry.role,
        relation: entry.relation,
        relationLabel: relationLabel(entry.relation),
        expectedMove: expectedMoveLabel(targetDirection, entry.relation),
        weight: entry.weight,
        alignment: "未評価",
        actualMove: "-",
        moveMeaning: "個別分析で確認します。",
        impact: "全体スキャンでは速度を優先し、個別分析で詳しく確認します。",
        detail: "個別分析で確認します。"
      })),
      timeframe: TIMEFRAMES[timeframe]?.label || timeframe
    };
  }

  const loaded = await Promise.all(plan.map((entry) => loadDriver(entry, provider, timeframe)));
  let supportWeight = 0;
  let headwindWeight = 0;
  let neutralWeight = 0;
  let supportCount = 0;
  let headwindCount = 0;
  let neutralCount = 0;
  let unavailableCount = 0;

  const drivers = loaded.map((driver) => {
    if (!driver.available) {
      unavailableCount += 1;
      neutralWeight += driver.weight * 0.5;
      return {
        ...driver,
        relationLabel: relationLabel(driver.relation),
        expectedMove: expectedMoveLabel(targetDirection, driver.relation),
        moveMeaning: "関連データを取得できません。",
        impact: impactText({ asset, targetDirection, driver, alignment: "取得不可", meaning: "関連データを取得できない" })
      };
    }
    const expected = expectedValue(targetDirection, driver.relation);
    const alignment = alignmentLabel(driver.actualValue, expected, driver.relation);
    if (alignment === "追い風") {
      supportWeight += driver.weight;
      supportCount += 1;
    } else if (alignment === "逆風") {
      headwindWeight += driver.weight;
      headwindCount += 1;
    } else {
      neutralWeight += driver.weight;
      neutralCount += 1;
    }
    return {
      symbol: driver.symbol,
      role: driver.role,
      relation: driver.relation,
      relationLabel: relationLabel(driver.relation),
      expectedMove: expectedMoveLabel(targetDirection, driver.relation),
      weight: driver.weight,
      alignment,
      actualMove: driver.actualMove,
      moveMeaning: driver.moveMeaning,
      impact: impactText({ asset, targetDirection, driver, alignment, meaning: driver.moveMeaning }),
      latestClose: driver.latestClose,
      trendStrength: driver.trendStrength,
      qualityScore: driver.quality?.score ?? 0,
      detail: driver.detail
    };
  });

  const totalWeight = Math.max(1, supportWeight + headwindWeight + neutralWeight);
  const score = Math.round(clamp(50 + ((supportWeight - headwindWeight) / totalWeight) * 50));
  const status = score >= 70 ? "追い風" : score <= 40 ? "逆風" : "中立";
  const confidenceAdjustment = score >= 70 ? 6 : score <= 40 ? -12 : score <= 55 ? -4 : 0;

  return {
    score,
    status,
    confidenceAdjustment,
    summary: summarizeMap(score, supportCount, headwindCount, unavailableCount),
    supportCount,
    headwindCount,
    neutralCount,
    unavailableCount,
    drivers,
    timeframe: TIMEFRAMES[timeframe]?.label || timeframe
  };
}

function scoreCurrency(raw, maxAbs) {
  if (!Number.isFinite(raw) || maxAbs <= 0) return 50;
  return Math.round(clamp(50 + (raw / maxAbs) * 50));
}

function strengthLabel(score) {
  if (score >= 75) return "かなり強い";
  if (score >= 60) return "強い";
  if (score <= 25) return "かなり弱い";
  if (score <= 40) return "弱い";
  return "中立";
}

function pairImpactFromTrend(symbol, trend) {
  const [base, quote] = currencyParts(symbol);
  const rawStrength = clamp(Math.abs(trend.strength) * 6500, 0.45, 1.35);
  if (trend.value > 0) {
    return {
      base,
      quote,
      baseDelta: rawStrength,
      quoteDelta: -rawStrength,
      meaning: `${base}が${quote}より強い`
    };
  }
  if (trend.value < 0) {
    return {
      base,
      quote,
      baseDelta: -rawStrength,
      quoteDelta: rawStrength,
      meaning: `${quote}が${base}より強い`
    };
  }
  return {
    base,
    quote,
    baseDelta: 0,
    quoteDelta: 0,
    meaning: `${base}と${quote}は横ばい`
  };
}

export async function buildCurrencyStrengthMap({ provider, interval, includeContext = true }) {
  const timeframe = normalizeTimeframe(interval);
  const baseState = Object.fromEntries(MAJOR_CURRENCIES.map((currency) => [currency.code, {
    ...currency,
    raw: 0,
    checkedPairs: 0,
    unavailablePairs: 0,
    notes: []
  }]));

  if (!includeContext) {
    return {
      enabled: false,
      status: "未評価",
      reason: "全体スキャンでは速度を優先し、通貨強弱は個別FX分析で表示します。",
      currencies: Object.values(baseState).map((currency) => ({ ...currency, score: 50, label: "未評価" })),
      strongest: [],
      weakest: [],
      pairs: [],
      timeframe: TIMEFRAMES[timeframe]?.label || timeframe
    };
  }

  const pairs = await Promise.all(MAJOR_FX_PAIRS.map(async (symbol) => {
    try {
      const result = await getCandles({ symbol, provider, interval: timeframe });
      const quality = assessDataQuality(result.candles, result.source, { interval: timeframe });
      if (!quality.usable) {
        const [base, quote] = currencyParts(symbol);
        if (baseState[base]) baseState[base].unavailablePairs += 1;
        if (baseState[quote]) baseState[quote].unavailablePairs += 1;
        return {
          symbol,
          ok: false,
          meaning: quality.issues[0] || "データ不足",
          qualityScore: quality.score
        };
      }
      const trend = trendDirection(latestFeatures(result.candles));
      const impact = pairImpactFromTrend(symbol, trend);
      baseState[impact.base].raw += impact.baseDelta;
      baseState[impact.quote].raw += impact.quoteDelta;
      baseState[impact.base].checkedPairs += 1;
      baseState[impact.quote].checkedPairs += 1;
      baseState[impact.base].notes.push(`${symbol}: ${impact.meaning}`);
      baseState[impact.quote].notes.push(`${symbol}: ${impact.meaning}`);
      return {
        symbol,
        ok: true,
        trend: trend.label,
        meaning: impact.meaning,
        qualityScore: quality.score
      };
    } catch (error) {
      return {
        symbol,
        ok: false,
        meaning: `取得失敗: ${error.message}`,
        qualityScore: 0
      };
    }
  }));

  const maxAbs = Math.max(...Object.values(baseState).map((currency) => Math.abs(currency.raw)), 0.0001);
  const currencies = Object.values(baseState)
    .map((currency) => {
      const score = scoreCurrency(currency.raw, maxAbs);
      return {
        code: currency.code,
        name: currency.name,
        score,
        label: strengthLabel(score),
        raw: round(currency.raw, 3),
        checkedPairs: currency.checkedPairs,
        unavailablePairs: currency.unavailablePairs,
        notes: currency.notes.slice(0, 3)
      };
    })
    .sort((a, b) => b.score - a.score);

  return {
    enabled: true,
    status: "計算済み",
    summary: `主要7通貨を21ペアで比較しました。最強は${currencies[0]?.code}、最弱は${currencies.at(-1)?.code}です。`,
    currencies,
    strongest: currencies.slice(0, 3),
    weakest: currencies.slice(-3).reverse(),
    pairs,
    timeframe: TIMEFRAMES[timeframe]?.label || timeframe,
    method: "主要7通貨の21通貨ペアから、上向きなら左側通貨を強く、下向きなら右側通貨を強く数えます。"
  };
}
