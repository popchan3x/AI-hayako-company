import { ASSETS, findAsset } from "./assets.js";
import { getCandles } from "./dataProvider.js";
import { latestFeatures, round } from "./indicators.js";
import { buildPricePlan } from "./pricing.js";
import { runModelTournament } from "./backtest.js";
import { classifyMarketRegime } from "./marketRegime.js";

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

function buildWarnings(features, dataWarning, regime) {
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
  warnings.push("重要指標カレンダーは未接続です。発表前後の見送りも確認してください。");

  return unique(warnings).slice(0, 5);
}

function buildAiExplanation(asset, signal) {
  if (signal.direction === "見送り") {
    return `${asset.name}は今すぐ入るより、次のはっきりした動きを待つ形です。選択モデルは${signal.selectedModel}、相場環境は${signal.marketRegime.name}、モデル一致度は${signal.modelAgreement}%です。`;
  }
  return `${asset.name}は短期では${signal.direction}を優先して見る形です。入口は${signal.entryPrice}、損切りは${signal.stopLoss}、利確は${signal.takeProfit}です。選択モデルは${signal.selectedModel}、モデル一致度は${signal.modelAgreement}%です。`;
}

function buildXDraft(asset, signal) {
  return [
    `${asset.symbol} 検証用シグナル`,
    `方向: ${signal.direction}`,
    `入口: ${signal.entryPrice} / 損切り: ${signal.stopLoss} / 利確: ${signal.takeProfit}`,
    `信頼度: ${signal.confidence}/100`,
    `相場環境: ${signal.marketRegime.name}`,
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
    netReturn: round(entry.metrics.netReturn * 100, 2),
    maxDrawdown: round(entry.metrics.maxDrawdown * 100, 2),
    fit: entry.regimeFit,
    score: round(entry.adjustedScore, 2)
  }));
}

function directionAgreement(tournament, direction) {
  if (!tournament.length) return 0;
  const same = tournament.filter((entry) => entry.currentSignal.direction === direction).length;
  return Math.round((same / tournament.length) * 100);
}

function selectMetaSignal(tournament, features, regime) {
  const winner = tournament[0];
  const base = winner.currentSignal;
  const agreement = directionAgreement(tournament, base.direction);
  const reasons = unique([
    `モデル大会では${base.name}が1位です。`,
    `相場環境は${regime.name}で、危険度は${regime.riskLevel}です。`,
    ...base.rationale,
    ...regime.reasons
  ]).slice(0, 5);

  let direction = base.direction;
  let confidence = base.confidence;
  confidence += agreement >= 50 ? 6 : -8;
  confidence += winner.metrics.profitFactor >= 1.15 ? 5 : -4;
  confidence += winner.metrics.trades >= 4 ? 3 : -6;
  confidence += winner.regimeFit;

  if (agreement < 50) confidence = Math.min(confidence, 74);
  if (agreement < 30) confidence = Math.min(confidence, 68);

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
    selectedModel: base.name,
    modelAgreement: agreement,
    marketRegime: regime,
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

  if (!candles || candles.length < MIN_CANDLES) {
    return unavailable(asset.symbol, `必要な価格データが不足しています。必要${MIN_CANDLES}本、取得${candles?.length || 0}本です。`, source);
  }

  const tournament = runModelTournament(candles);
  const features = latestFeatures(candles);
  const regime = classifyMarketRegime(candles);
  const metaSignal = selectMetaSignal(tournament, features, regime);
  const signal = {
    ...metaSignal,
    validationLabel: "検証用シグナル",
    warnings: buildWarnings(features, warning, regime)
  };
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
    regime,
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
