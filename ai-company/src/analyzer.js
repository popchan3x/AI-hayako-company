import { ASSETS, findAsset } from "./assets.js";
import { getCandles } from "./dataProvider.js";
import { latestFeatures, round } from "./indicators.js";
import { buildPricePlan } from "./pricing.js";
import { runModelTournament } from "./backtest.js";
import { classifyMarketRegime } from "./marketRegime.js";
import { assessDataQuality } from "./dataQuality.js";
import { estimateTradingCosts } from "./costs.js";
import { buildWorldClassIntelligence } from "./worldClassIntelligence.js";

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

function buildWarnings(features, dataWarning, regime, dataQuality, costs) {
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
  warnings.push("重要指標カレンダーは未接続です。発表前後の見送りも確認してください。");

  return unique(warnings).slice(0, 5);
}

function buildAiExplanation(asset, signal) {
  if (signal.direction === "見送り") {
    return `${asset.name}は今すぐ入るより、次のはっきりした動きを待つ形です。最終判断は${signal.selectedModel}、相場環境は${signal.marketRegime.name}、モデル一致度は${signal.modelAgreement}%、データ品質は${signal.dataQuality.grade}です。`;
  }
  return `${asset.name}は短期では${signal.direction}を優先して見る形です。入口は${signal.entryPrice}、損切りは${signal.stopLoss}、利確は${signal.takeProfit}です。最終判断は${signal.selectedModel}、主導モデルは${signal.leadModel}、モデル一致度は${signal.modelAgreement}%です。`;
}

function buildXDraft(asset, signal) {
  return [
    `${asset.symbol} 検証用シグナル`,
    `方向: ${signal.direction}`,
    `入口: ${signal.entryPrice} / 損切り: ${signal.stopLoss} / 利確: ${signal.takeProfit}`,
    `信頼度: ${signal.confidence}/100`,
    `相場環境: ${signal.marketRegime.name}`,
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

function buildRiskSummary(regime, dataQuality, costs, modelAgreement) {
  const items = [
    `相場環境: ${regime.name}、危険度${regime.riskLevel}`,
    `データ品質: ${dataQuality.grade}、スコア${dataQuality.score}/100`,
    `売買コスト概算: ${costs.totalBps}bp`,
    `モデル一致度: ${modelAgreement}%`
  ];
  if (modelAgreement < 50) items.push("モデルが割れているため、信頼度を抑えています。");
  if (dataQuality.score < 70) items.push("データ品質が十分ではないため、分析不可または見送りを優先します。");
  return items.slice(0, 6);
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

export async function analyzeSymbol(symbol, options = {}) {
  const asset = findAsset(symbol);
  if (!asset) return unavailable(symbol, "登録されていない分析対象です。");

  const { candles, source, warning } = await getCandles({
    symbol: asset.symbol,
    provider: options.provider || "demo"
  });
  const dataQuality = assessDataQuality(candles, source);

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
  const signal = {
    ...metaSignal,
    validationLabel: "検証用シグナル",
    warnings: buildWarnings(features, warning, regime, dataQuality, costs)
  };
  signal.intelligence = buildWorldClassIntelligence({
    asset,
    signal,
    features,
    tournament,
    regime,
    dataQuality,
    costs
  });
  signal.explanation = buildAiExplanation(asset, signal, features);
  signal.xDraft = buildXDraft(asset, signal);

  return {
    ok: true,
    status: "分析完了",
    asset,
    symbol: asset.symbol,
    source,
    candles: candles.slice(-120),
    signal,
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
