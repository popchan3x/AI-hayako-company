import { ASSETS, findAsset } from "./assets.js";
import { getCandles, TIMEFRAMES, normalizeTimeframe } from "./dataProvider.js";
import { latestFeatures, round } from "./indicators.js";
import { buildPricePlan } from "./pricing.js";
import { runModelTournament } from "./backtest.js";
import { classifyMarketRegime } from "./marketRegime.js";
import { assessDataQuality } from "./dataQuality.js";
import { estimateTradingCosts } from "./costs.js";
import { buildWorldClassIntelligence } from "./worldClassIntelligence.js";
import { buildCurrencyStrengthMap, buildImportantEventFilter, buildMarketLinkageMap } from "./marketGuards.js";
import { buildLegendTraderPlaybooks } from "./traderPlaybooks.js";

const MIN_CANDLES = 90;
const DIRECTIONS = ["買い", "売り", "見送り"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function unavailable(symbol, reason, source = "unknown") {
  return {
    ok: false,
    symbol,
    source,
    status: "分析不可",
    reason,
    signal: null,
    tournament: [],
    generatedAt: new Date().toISOString()
  };
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function buildWarnings(features, dataWarning, regime, dataQuality, costs, marketLinkage, eventFilter) {
  const warnings = [
    dataWarning,
    "検証用シグナルです。実売買の最終判断はユーザーが行ってください。"
  ];

  if (features.atr14 && features.close && features.atr14 / features.close > 0.012) {
    warnings.push("値動きが荒い状態です。損切り幅を小さくしすぎないでください。");
  }
  if (features.volumeRatio < 0.65) {
    warnings.push("出来高が平均より少なく、価格が飛びやすい可能性があります。");
  }
  if (regime.riskLevel === "高い") {
    warnings.push("相場環境の危険度が高いため、見送りも候補に入れてください。");
  }
  if (dataQuality.grade !== "高い") {
    warnings.push(`データ品質は${dataQuality.grade}です。根拠が弱い場合は見送りを優先してください。`);
  }
  if (costs.totalBps >= 5) {
    warnings.push(`売買コストの概算は${costs.totalBps}bpです。短い利幅では不利になりやすいです。`);
  }
  if (marketLinkage?.status === "逆風") {
    warnings.push(`周辺市場は逆風です。${marketLinkage.summary}`);
  }
  if (eventFilter?.status !== "通常") {
    warnings.push(eventFilter.warnings[0]);
  }
  warnings.push(eventFilter?.calendarStatus || "重要指標カレンダーは未接続です。発表前後の見送りも確認してください。");

  return unique(warnings).slice(0, 5);
}

function buildAiExplanation(asset, signal) {
  if (signal.direction === "見送り") {
    return `${asset.name}は今すぐ入るより、次のはっきりした動きを待つ形です。最終判断は${signal.selectedModel}、相場環境は${signal.marketRegime.name}、市場連動は${signal.marketLinkage.status}、重要予定は${signal.eventFilter.status}、データ品質は${signal.dataQuality.grade}です。`;
  }
  return `${asset.name}は短期では${signal.direction}を優先して見る形です。入口は${signal.entryPrice}、損切りは${signal.stopLoss}、利確は${signal.takeProfit}です。市場連動は${signal.marketLinkage.status}、重要予定は${signal.eventFilter.status}、モデル一致度は${signal.modelAgreement}%です。`;
}

function buildXDraft(asset, signal) {
  return [
    `${asset.symbol} 検証用シグナル`,
    `方向: ${signal.direction}`,
    `入口: ${signal.entryPrice} / 損切り: ${signal.stopLoss} / 利確: ${signal.takeProfit}`,
    `信頼度: ${signal.confidence}/100`,
    `相場環境: ${signal.marketRegime.name}`,
    `市場連動: ${signal.marketLinkage.status} ${signal.marketLinkage.score}/100`,
    `重要予定: ${signal.eventFilter.status} ${signal.eventFilter.score}/100`,
    `データ品質: ${signal.dataQuality.grade}`,
    "直接の売買推奨ではありません。検証用メモです。"
  ].join("\n");
}

function formatTournament(tournament) {
  return tournament.map((entry) => ({
    name: entry.name,
    direction: entry.currentSignal.direction,
    confidence: entry.currentSignal.confidence,
    trades: entry.metrics.trades,
    winRate: round(entry.metrics.winRate * 100, 1),
    profitFactor: round(entry.metrics.profitFactor, 2),
    payoffRatio: round(entry.metrics.payoffRatio, 2),
    expectancy: round(entry.metrics.expectancy * 100, 3),
    netReturn: round(entry.metrics.netReturn * 100, 2),
    maxDrawdown: round(entry.metrics.maxDrawdown * 100, 2),
    maxLossStreak: entry.metrics.maxLossStreak,
    fit: entry.regimeFit,
    score: round(entry.adjustedScore, 2)
  }));
}

function directionAgreement(tournament, direction) {
  if (!tournament.length) return 0;
  const same = tournament.filter((entry) => entry.currentSignal.direction === direction).length;
  return Math.round((same / tournament.length) * 100);
}

function modelWeight(entry) {
  const scoreWeight = Math.max(0.3, 1 + entry.adjustedScore / 25);
  const confidenceWeight = entry.currentSignal.confidence / 100;
  const sampleWeight = Math.max(0.45, Math.min(1, entry.metrics.trades / 8));
  const profitWeight = Math.max(0.4, Math.min(1.4, entry.metrics.profitFactor / 1.2));
  return scoreWeight * confidenceWeight * sampleWeight * profitWeight;
}

function weightedDirection(tournament) {
  const weights = { "買い": 0, "売り": 0, "見送り": 0 };
  for (const entry of tournament) {
    weights[entry.currentSignal.direction] += modelWeight(entry);
  }
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  const direction = Object.entries(weights).sort((a, b) => b[1] - a[1])[0][0];
  return {
    direction,
    agreement: Math.round((weights[direction] / total) * 100),
    weights: {
      buy: round((weights["買い"] / total) * 100, 1),
      sell: round((weights["売り"] / total) * 100, 1),
      wait: round((weights["見送り"] / total) * 100, 1)
    }
  };
}

function buildScenarios(direction, features) {
  const atr = features.atr14 || features.close * 0.01;
  const support = round(features.support ?? features.close - atr * 2, 4);
  const resistance = round(features.resistance ?? features.close + atr * 2, 4);
  const close = round(features.close, 4);

  if (direction === "買い") {
    return [
      `上向き案: ${resistance}を上回り、出来高が平均以上なら買い目線を継続します。`,
      `失敗案: ${support}を下回る場合は、買い目線を弱めます。`,
      `待機案: ${close}付近で方向が出ない場合は、次の足まで待ちます。`
    ];
  }
  if (direction === "売り") {
    return [
      `下向き案: ${support}を下回り、戻りが弱いなら売り目線を継続します。`,
      `失敗案: ${resistance}を上回る場合は、売り目線を弱めます。`,
      `待機案: ${close}付近で方向が出ない場合は、次の足まで待ちます。`
    ];
  }
  return [
    `上向き案: ${resistance}を明確に上回るまで買いは急ぎません。`,
    `下向き案: ${support}を明確に下回るまで売りは急ぎません。`,
    `待機案: モデルの方向がそろうまで見送りを優先します。`
  ];
}

function buildRiskSummary(regime, dataQuality, costs, modelAgreement, marketLinkage, eventFilter) {
  const items = [
    `相場環境: ${regime.name}、危険度${regime.riskLevel}`,
    marketLinkage ? `市場連動: ${marketLinkage.status}、スコア${marketLinkage.score}/100` : null,
    eventFilter ? `重要予定: ${eventFilter.status}、スコア${eventFilter.score}/100` : null,
    `データ品質: ${dataQuality.grade}、スコア${dataQuality.score}/100`,
    `売買コスト概算: ${costs.totalBps}bp`,
    `モデル一致度: ${modelAgreement}%`
  ].filter(Boolean);
  if (modelAgreement < 50) items.push("モデルが割れているため、信頼度を抑えています。");
  if (dataQuality.score < 70) items.push("データ品質が十分ではないため、分析不可または見送りを優先します。");
  if (marketLinkage?.status === "逆風") items.push("周辺市場の逆風があるため、入口を急がない判断を強めます。");
  if (eventFilter?.status === "見送り優先") items.push("重要予定の警戒時間内のため、見送りを優先します。");
  return items.slice(0, 6);
}

function scoreFromDistance(value, center, width) {
  return clamp(Math.round(100 - Math.abs(value - center) * width), 0, 100);
}

function buildAnalysisMaterials(features, tournament, regime, dataQuality, costs, timeframe, marketLinkage, eventFilter, legendPlaybooks) {
  const leader = tournament[0];
  const trendScore = features.sma20 > features.sma50 ? 72 : 48;
  const momentumScore = scoreFromDistance(features.rsi14 || 50, 58, 2.2);
  const volatilityScore = features.atr14 && features.close
    ? clamp(Math.round((features.atr14 / features.close) * 5200), 0, 100)
    : 0;
  const volumeScore = clamp(Math.round((features.volumeRatio || 0) * 70), 0, 100);
  const levelScore = features.support && features.resistance
    ? clamp(Math.round(((features.resistance - features.support) / features.close) * 4000), 0, 100)
    : 0;

  return {
    timeframe: {
      value: timeframe,
      label: TIMEFRAMES[timeframe]?.label || timeframe
    },
    summary: [
      "価格の方向、勢い、荒さ、出来高、節目、モデル大会、コスト、データ品質を同時に見ています。",
      "AIは売買を直感で決めず、数字の矛盾チェックとシナリオ整理に使います。",
      "有料級ツールの考え方に合わせ、見た目、根拠、検証結果、注意点を1画面に集約します。",
      legendPlaybooks ? `世界的トレーダー6組の考え方との一致度は${legendPlaybooks.score}/100です。` : null
    ].filter(Boolean),
    cards: [
      { name: "トレンド", score: trendScore, detail: `20本平均と50本平均の位置を確認。現在は${features.sma20 > features.sma50 ? "上向き寄り" : "下向きまたは横ばい寄り"}です。` },
      { name: "勢い", score: momentumScore, detail: `RSIは${round(features.rsi14, 1)}です。買われすぎ、売られすぎ、伸び余地を見ます。` },
      { name: "荒さ", score: volatilityScore, detail: `ATRは価格の${round((features.atr14 / features.close) * 100, 2)}%です。損切り幅と急変リスクに使います。` },
      { name: "出来高", score: volumeScore, detail: `直近出来高は平均比${round(features.volumeRatio, 2)}倍です。動きの本気度を見ます。` },
      { name: "節目", score: levelScore, detail: `支持線${round(features.support, 4)}、抵抗線${round(features.resistance, 4)}を入口と撤退の目安にします。` },
      { name: "モデル大会", score: clamp(Math.round((leader?.adjustedScore || 0) + 55), 0, 100), detail: `${leader?.name || "未計算"}が現在の首位です。複数モデルの勝ち筋を比較します。` },
      { name: "コスト", score: clamp(100 - costs.totalBps * 8, 0, 100), detail: `想定コストは${costs.totalBps}bpです。短期足ほど重く見ます。` },
      { name: "市場連動", score: marketLinkage?.score ?? 50, detail: marketLinkage?.summary || "周辺市場の確認は個別分析で行います。" },
      { name: "重要予定", score: eventFilter?.score ?? 100, detail: eventFilter?.warnings?.[0] || "直近の警戒時間はありません。" },
      { name: "データ品質", score: dataQuality.score, detail: `${dataQuality.decision} ${dataQuality.score}/100です。欠損や遅延がある時は見送りを強めます。` },
      legendPlaybooks ? { name: "巨匠手法", score: legendPlaybooks.score, detail: legendPlaybooks.summary } : null
    ].filter(Boolean),
    legendPlaybooks,
    playbook: [
      legendPlaybooks ? `巨匠手法では、${legendPlaybooks.cards[0].trader}、${legendPlaybooks.cards[1].trader}など6組の型と照合します。` : null,
      `${regime.name}では、主役モデルだけでなくモデル一致度を重視します。`,
      "市場連動、重要予定、データ品質の3つで危険なシグナルをふるい落とします。",
      "入口、損切り、利確はチャートの水平線で確認します。",
      "短期足で方向が出ても、日足の大きな流れと逆ならサイズを小さく扱います。"
    ].filter(Boolean)
  };
}

function selectMetaSignal(tournament, features, regime, dataQuality, costs) {
  const winner = tournament[0];
  const base = winner.currentSignal;
  const ensemble = weightedDirection(tournament);
  const countAgreement = directionAgreement(tournament, ensemble.direction);
  const agreement = Math.max(ensemble.agreement, countAgreement);
  const reasons = unique([
    `モデル大会では${base.name}が1位です。`,
    `重み付き判断では${ensemble.direction}が${ensemble.agreement}%です。`,
    `相場環境は${regime.name}で、危険度は${regime.riskLevel}です。`,
    ...base.rationale,
    ...regime.reasons
  ]).slice(0, 5);

  let direction = ensemble.agreement >= 42 ? ensemble.direction : base.direction;
  let confidence = base.confidence;
  confidence += agreement >= 50 ? 6 : -8;
  confidence += winner.metrics.profitFactor >= 1.15 ? 5 : -4;
  confidence += winner.metrics.trades >= 4 ? 3 : -6;
  confidence += winner.regimeFit;
  confidence += dataQuality.score >= 90 ? 4 : dataQuality.score >= 70 ? 0 : -12;
  confidence -= Math.max(0, costs.totalBps - 4) * 1.2;

  if (agreement < 50) confidence = Math.min(confidence, 74);
  if (agreement < 30) confidence = Math.min(confidence, 68);
  if (dataQuality.score < 70) confidence = Math.min(confidence, 62);

  let confidenceCap = 92;
  if (dataQuality.source === "demo") confidenceCap = Math.min(confidenceCap, 82);
  if (winner.metrics.trades < 6) confidenceCap = Math.min(confidenceCap, 78);
  if (agreement < 70) confidenceCap = Math.min(confidenceCap, 82);
  if (costs.totalBps >= 5) confidenceCap = Math.min(confidenceCap, 84);
  confidence = Math.min(confidence, confidenceCap);

  if (regime.riskLevel === "高い" && agreement < 50) {
    direction = "見送り";
    confidence = Math.min(confidence, 62);
    reasons.unshift("危険度が高く、モデルの方向も割れているため見送りを優先します。");
  }

  if (!DIRECTIONS.includes(direction)) direction = "見送り";

  return {
    ...base,
    ...buildPricePlan(direction, features),
    direction,
    confidence: clamp(Math.round(confidence), 0, 100),
    selectedModel: "Meta Ensemble",
    leadModel: base.name,
    modelAgreement: agreement,
    voteWeights: ensemble.weights,
    marketRegime: regime,
    dataQuality,
    costs,
    scenarios: buildScenarios(direction, features),
    riskSummary: buildRiskSummary(regime, dataQuality, costs, agreement),
    reasons: reasons.slice(0, 5),
    qualityChecks: {
      usesFutureData: false,
      includesCost: true,
      directPosting: false,
      directTrading: false
    }
  };
}

function applyDecisionGuards(signal, features, marketLinkage, eventFilter) {
  let direction = signal.direction;
  let confidence = signal.confidence + (marketLinkage?.confidenceAdjustment || 0) + (eventFilter?.confidenceAdjustment || 0);
  const reasons = [...signal.reasons];

  if (eventFilter?.status === "見送り優先" && direction !== "見送り") {
    direction = "見送り";
    confidence = Math.min(confidence, 62);
    reasons.unshift(`重要予定フィルターが${eventFilter.score}/100のため、見送りを優先します。`);
  } else if (eventFilter?.status === "警戒" && direction !== "見送り") {
    confidence = Math.min(confidence, 78);
    reasons.unshift(`重要予定フィルターが警戒です。${eventFilter.warnings[0]}`);
  }

  if (marketLinkage?.status === "逆風" && direction !== "見送り") {
    confidence = Math.min(confidence - 6, 68);
    reasons.unshift(`市場連動マップが逆風です。${marketLinkage.summary}`);
    if (signal.modelAgreement < 55) {
      direction = "見送り";
      reasons.unshift("周辺市場の逆風とモデル割れが重なったため、見送りに切り替えます。");
    }
  } else if (marketLinkage?.status === "追い風" && direction !== "見送り") {
    reasons.unshift(`市場連動マップが追い風です。${marketLinkage.summary}`);
  }

  if (signal.dataQuality.decision === "注意付き分析") {
    confidence = Math.min(confidence, 82);
  }

  confidence = clamp(Math.round(confidence), 0, 100);

  return {
    ...signal,
    ...buildPricePlan(direction, features),
    direction,
    confidence,
    marketLinkage,
    eventFilter,
    scenarios: buildScenarios(direction, features),
    riskSummary: buildRiskSummary(signal.marketRegime, signal.dataQuality, signal.costs, signal.modelAgreement, marketLinkage, eventFilter),
    reasons: unique(reasons).slice(0, 5),
    qualityChecks: {
      ...signal.qualityChecks,
      includesMarketLinkage: true,
      includesImportantEventFilter: true,
      includesDataQualityGate: true
    }
  };
}

export async function analyzeSymbol(symbol, options = {}) {
  const asset = findAsset(symbol);
  if (!asset) return unavailable(symbol, "登録されていない分析対象です。");
  const interval = normalizeTimeframe(options.interval);

  const { candles, source, warning } = await getCandles({
    symbol: asset.symbol,
    provider: options.provider || "demo",
    interval
  });
  const dataQuality = assessDataQuality(candles, source, { interval, requiredBars: MIN_CANDLES });

  if (!candles || candles.length < MIN_CANDLES || !dataQuality.usable) {
    return {
      ...unavailable(asset.symbol, `必要な価格データが不足しています。必要${MIN_CANDLES}本、取得${candles?.length || 0}本です。`, source),
      dataQuality
    };
  }

  const features = latestFeatures(candles);
  const costs = estimateTradingCosts(asset, features);
  const tournament = runModelTournament(candles, { costRate: costs.costRate });
  const regime = classifyMarketRegime(candles);
  const metaSignal = selectMetaSignal(tournament, features, regime, dataQuality, costs);
  const eventFilter = buildImportantEventFilter(asset);
  const marketLinkage = await buildMarketLinkageMap({
    asset,
    targetDirection: metaSignal.direction,
    provider: options.provider || "demo",
    interval,
    includeContext: options.includeContext !== false
  });
  const currencyStrength = asset.group === "FX"
    ? await buildCurrencyStrengthMap({
      provider: options.provider || "demo",
      interval,
      includeContext: options.includeContext !== false
    })
    : null;
  const guardedSignal = applyDecisionGuards(metaSignal, features, marketLinkage, eventFilter);
  const signal = {
    ...guardedSignal,
    currencyStrength,
    validationLabel: "検証用シグナル",
    warnings: buildWarnings(features, warning, regime, dataQuality, costs, marketLinkage, eventFilter)
  };
  signal.legendPlaybooks = buildLegendTraderPlaybooks({
    asset,
    candles,
    features,
    signal,
    tournament,
    regime,
    dataQuality
  });
  signal.intelligence = buildWorldClassIntelligence({
    asset,
    signal,
    features,
    tournament,
    regime,
    dataQuality,
    costs,
    legendPlaybooks: signal.legendPlaybooks
  });
  signal.explanation = buildAiExplanation(asset, signal, features);
  signal.xDraft = buildXDraft(asset, signal);

  return {
    ok: true,
    status: "分析完了",
    asset,
    symbol: asset.symbol,
    source,
    interval,
    timeframe: TIMEFRAMES[interval],
    candles: candles.slice(-180),
    signal,
    analysisMaterials: buildAnalysisMaterials(features, tournament, regime, dataQuality, costs, interval, marketLinkage, eventFilter, signal.legendPlaybooks),
    features: {
      close: round(features.close, 4),
      sma20: round(features.sma20, 4),
      sma50: round(features.sma50, 4),
      rsi14: round(features.rsi14, 2),
      atr14: round(features.atr14, 4),
      atrPercent: round((features.atr14 / features.close) * 100, 2),
      support: round(features.support, 4),
      resistance: round(features.resistance, 4),
      volumeRatio: round(features.volumeRatio, 2),
      slope24: round(features.slope24, 6)
    },
    dataQuality,
    costs,
    regime,
    intelligence: signal.intelligence,
    tournament: formatTournament(tournament),
    generatedAt: new Date().toISOString()
  };
}

export function listAssets() {
  return ASSETS;
}

export function researchRoadmap() {
  return {
    title: "モデル大会方式ロードマップ",
    phases: [
      "ルール、指標、時系列モデルを同じ過去データで比べる。",
      "資産別、時間帯別、相場環境別に勝率、損益、最大下落、手数料込み成績を見る。",
      "勝ったモデルを1つに固定せず、相場環境ごとに強いモデルを選ぶ仕組みにする。"
    ],
    nextModels: [
      "LightGBM系の表データモデル",
      "TFT、PatchTST、iTransformer、TimesNetなどの時系列AI",
      "Chronos系の汎用時系列モデル",
      "FinGPT系のニュース感情分析"
    ],
    guardrails: [
      "未来データを使わない。",
      "手数料、スプレッド、ずれを入れて成績を見る。",
      "無料データが欠けたら推測せず、分析不可と出す。",
      "表示は検証用に限定し、実売買とX投稿はユーザーが行う。"
    ],
    references: [
      "Temporal Fusion Transformers: https://arxiv.org/abs/1912.09363",
      "PatchTST: https://arxiv.org/abs/2211.14730",
      "iTransformer: https://arxiv.org/abs/2310.06625",
      "TimesNet: https://openreview.net/forum?id=ju_Uqw384Oq",
      "Chronos: https://arxiv.org/abs/2403.07815",
      "FinGPT: https://arxiv.org/abs/2306.06031"
    ]
  };
}
