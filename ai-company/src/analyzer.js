import { ASSETS, findAsset } from "./assets.js";
import { getCandles } from "./dataProvider.js";
import { latestFeatures, round } from "./indicators.js";
import { runModelTournament } from "./backtest.js";

const MIN_CANDLES = 90;

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

function buildWarnings(features, dataWarning) {
  const warnings = [dataWarning, "検証用シグナルです。実売買の最終判断は人が行ってください。"];
  if (features.atr14 && features.close && features.atr14 / features.close > 0.012) {
    warnings.push("値動きが荒い状態です。損切り幅を小さくしすぎないでください。");
  }
  warnings.push("重要指標カレンダーは未接続です。発表前後は見送りも検討してください。");
  return warnings.filter(Boolean).slice(0, 4);
}

function buildAiExplanation(asset, signal, features) {
  const directionText = signal.direction === "見送り"
    ? "今は無理に入らず、次のはっきりした動きを待つ形です。"
    : `${asset.name}は短期では${signal.direction}を優先して見る形です。`;
  return `${directionText} 現在値は${signal.entryPrice}、信頼度は${signal.confidence}です。根拠は平均線、勢い、直近の上値と下値、値動きの荒さを合わせて確認しています。損切りは${signal.stopLoss}、利確は${signal.takeProfit}を目安にします。`;
}

function buildXDraft(asset, signal) {
  return [
    `${asset.symbol} 検証用シグナル`,
    `方向: ${signal.direction}`,
    `入口: ${signal.entryPrice} / 損切り: ${signal.stopLoss} / 利確: ${signal.takeProfit}`,
    `信頼度: ${signal.confidence}/100`,
    "直接の売買推奨ではなく、検証用メモです。"
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
    score: round(entry.metrics.score, 2)
  }));
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
  const winner = tournament[0];
  const features = latestFeatures(candles);
  const signal = {
    ...winner.currentSignal,
    validationLabel: "検証用シグナル",
    reasons: winner.currentSignal.rationale.slice(0, 5),
    warnings: buildWarnings(features, warning),
    explanation: buildAiExplanation(asset, winner.currentSignal, features),
    xDraft: buildXDraft(asset, winner.currentSignal)
  };

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
      support: round(features.support, 4),
      resistance: round(features.resistance, 4),
      volumeRatio: round(features.volumeRatio, 2)
    },
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
      "ルールベース、指標スコア、時系列モメンタムを同じ過去データで比較する",
      "LightGBM、TFT、PatchTST、iTransformer、TimesNet、Chronos系を追加して比較する",
      "資産別、時間帯別、相場環境別に勝者モデルを切り替えるメタモデルを作る"
    ],
    guardrails: [
      "未来データを使わない",
      "手数料、スプレッド、スリッページを入れる",
      "無料データ欠損時は推測で価格を出さない",
      "実売買ではなく検証用として表示する"
    ]
  };
}
