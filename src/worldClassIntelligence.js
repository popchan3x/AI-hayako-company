import { round } from "./indicators.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreFromRange(value, idealMin, idealMax, hardMax) {
  if (!Number.isFinite(value)) return 45;
  if (value >= idealMin && value <= idealMax) return 88;
  if (value < idealMin) return clamp(55 + (value / Math.max(idealMin, 0.0001)) * 25);
  return clamp(88 - ((value - idealMax) / Math.max(hardMax - idealMax, 0.0001)) * 55);
}

function tournamentStrength(tournament) {
  if (!tournament.length) return 0;
  const leader = tournament[0];
  const trades = Math.min(leader.metrics.trades, 12);
  const profitFactor = Math.min(leader.metrics.profitFactor, 2);
  const drawdownPenalty = Math.min(30, leader.metrics.maxDrawdown * 400);
  return clamp(
    trades * 4
      + leader.metrics.winRate * 25
      + profitFactor * 18
      + Math.max(0, leader.adjustedScore) * 0.6
      - drawdownPenalty
  );
}

function factorScores({ signal, features, tournament, regime, dataQuality, costs, legendPlaybooks }) {
  const atrPercent = features.atr14 && features.close ? (features.atr14 / features.close) * 100 : 0;
  const trendScore = clamp(50 + regime.trendStrength * 12 + Math.abs(features.slope24 / features.close) * 12000);
  const momentumScore = features.rsi14 === null
    ? 50
    : clamp(100 - Math.abs(50 - features.rsi14) * 1.35);
  const volatilityScore = scoreFromRange(atrPercent, 0.18, 1.6, 4.5);
  const liquidityScore = clamp(45 + features.volumeRatio * 28 - costs.totalBps * 3.2);
  const validationScore = tournamentStrength(tournament);
  const agreementScore = clamp(signal.modelAgreement);
  const riskScore = clamp(100 - costs.totalBps * 4 - (regime.riskLevel === "高い" ? 18 : 0));
  const dataScore = clamp(dataQuality.score);
  const marketLinkScore = clamp(signal.marketLinkage?.score ?? 50);
  const eventScore = clamp(signal.eventFilter?.score ?? 100);
  const legendScore = clamp(legendPlaybooks?.score ?? signal.legendPlaybooks?.score ?? 50);

  return [
    { name: "データ品質", score: dataScore, detail: `${dataQuality.bars}本、品質${dataQuality.score}/100` },
    { name: "市場連動", score: marketLinkScore, detail: signal.marketLinkage?.summary || "周辺市場は未評価です。" },
    { name: "重要予定", score: eventScore, detail: signal.eventFilter?.warnings?.[0] || "重要予定の警戒はありません。" },
    { name: "モデル検証", score: validationScore, detail: `${tournament[0]?.metrics.trades || 0}回の過去検証を反映` },
    { name: "モデル一致", score: agreementScore, detail: `一致度${signal.modelAgreement}%` },
    { name: "流れ", score: trendScore, detail: `相場環境は${regime.name}` },
    { name: "勢い", score: momentumScore, detail: `RSI ${round(features.rsi14, 1)}` },
    { name: "値動き", score: volatilityScore, detail: `値動き幅${round(atrPercent, 2)}%` },
    { name: "売買しやすさ", score: liquidityScore, detail: `出来高倍率${round(features.volumeRatio, 2)}、費用${costs.totalBps}bp` },
    { name: "巨匠手法", score: legendScore, detail: legendPlaybooks?.summary || signal.legendPlaybooks?.summary || "名トレーダーの考え方との一致を確認します。" },
    { name: "守り", score: riskScore, detail: `リスク水準${regime.riskLevel}` }
  ].map((item) => ({ ...item, score: Math.round(clamp(item.score)) }));
}

function weightedEdgeScore(factors) {
  const weights = {
    "データ品質": 1.15,
    "市場連動": 1,
    "重要予定": 1.15,
    "モデル検証": 1.25,
    "モデル一致": 1.05,
    "流れ": 0.9,
    "勢い": 0.75,
    "値動き": 0.75,
    "売買しやすさ": 0.9,
    "巨匠手法": 1.05,
    "守り": 1.1
  };
  const totalWeight = factors.reduce((sum, factor) => sum + (weights[factor.name] || 1), 0);
  const total = factors.reduce((sum, factor) => sum + factor.score * (weights[factor.name] || 1), 0);
  return Math.round(total / totalWeight);
}

function blindSpots({ asset, dataQuality }) {
  const items = [];
  if (dataQuality.source === "demo") {
    items.push("現在はデモデータです。実データで同じ結果になるとは限りません。");
  }
  items.push("板情報、先物建玉、オプション、ニュース、実際の重要指標カレンダーはまだ未接続です。");
  if (asset.group === "FX" || asset.group === "貴金属") {
    items.push("金利差、ドル指数、米国債利回り、VIXをまだ直接見ていません。");
  }
  if (asset.group === "米国株" || asset.group === "日本株" || asset.group === "指数ETF") {
    items.push("決算日、指数寄与度、セクター資金流入はまだ直接見ていません。");
  }
  return items.slice(0, 4);
}

function externalSignalMap(asset) {
  const cryptoRelevant = /BTC|ETH|SOL|XRP|DOGE|ADA/.test(asset.symbol);
  return [
    {
      name: "板と流動性",
      status: "未接続",
      use: "大口注文、急な薄さ、だまし上げ下げの検出に使う"
    },
    {
      name: "先物とオプション",
      status: "未接続",
      use: "資金調達率、建玉、満期、偏った賭けを確認する"
    },
    {
      name: "市場連動",
      status: "軽量接続",
      use: "関連銘柄、ドル代理、金利代理、VIX代理で追い風と逆風を見る"
    },
    {
      name: "重要予定",
      status: "定例時間で接続",
      use: "経済指標が出やすい時間、寄り付き、引けで見送り判定を強くする"
    },
    {
      name: "データ品質",
      status: "接続済み",
      use: "欠損、遅延、異常値、必要本数を確認し、壊れたデータなら分析を止める"
    },
    {
      name: "ニュースとSNS",
      status: "未接続",
      use: "急な材料と市場心理を短く説明する"
    },
    {
      name: "オンチェーン",
      status: cryptoRelevant ? "未接続" : "対象外",
      use: cryptoRelevant ? "取引所入出金と大口移動を見る" : "暗号資産を追加したときに使う"
    }
  ];
}

function nextDataUpgrades(asset) {
  const common = [
    "無料価格データ元を2つ以上に増やす",
    "経済指標カレンダーと祝日カレンダーを接続する",
    "ニュース感情スコアを追加する"
  ];
  if (asset.group === "FX" || asset.group === "貴金属") {
    return [
      ...common,
      "ドル指数、米国債利回り、VIXを追加する",
      "先物建玉とオプション偏りを追加する"
    ];
  }
  if (asset.group === "米国株" || asset.group === "日本株") {
    return [
      ...common,
      "決算日、セクター、指数寄与度を追加する",
      "大型株と同業比較を追加する"
    ];
  }
  return [
    ...common,
    "ETF構成銘柄と資金流入を追加する",
    "指数先物とVIXを追加する"
  ];
}

function safetyGate({ edgeScore, dataQuality, signal }) {
  const blockers = [
    "売買API、秘密鍵、証券口座、外部決済には未接続",
    "実データ元が2つ以上になるまで自動売買禁止",
    "90日以上の紙上検証が終わるまで自動売買禁止",
    "1日の最大損失、1回の最大損失、緊急停止ボタンが未設定"
  ];
  if (dataQuality.source === "demo") blockers.unshift("デモデータのため自動売買禁止");
  if (signal.confidence < 75 || edgeScore < 75) blockers.unshift("信頼度または勝ち筋スコアが75未満");

  return {
    status: "自動売買禁止",
    analysisOnly: true,
    canAutoTrade: false,
    paperTradeReady: dataQuality.source !== "demo" && edgeScore >= 70 && signal.confidence >= 70,
    blockers: [...new Set(blockers)].slice(0, 6),
    requiredBeforeAutoTrading: [
      "読み取り専用のデータ連携を先に作る",
      "紙上売買で90日、最低300件の結果を保存する",
      "勝率、損益、最大下落、連敗数を毎日確認する",
      "APIキーは環境変数だけに置き、画面やログに出さない",
      "1クリックで止まる緊急停止を作る"
    ]
  };
}

export function buildWorldClassIntelligence(context) {
  const factors = factorScores(context);
  const edgeScore = weightedEdgeScore(factors);
  const readinessScore = Math.round((edgeScore * 0.55) + (context.signal.confidence * 0.25) + (context.dataQuality.score * 0.2));
  const gate = safetyGate({ edgeScore, dataQuality: context.dataQuality, signal: context.signal });

  return {
    edgeScore,
    readinessScore,
    verdict: edgeScore >= 78 ? "強い候補" : edgeScore >= 65 ? "条件付き候補" : "見送り優先",
    factors,
    blindSpots: blindSpots(context),
    externalSignals: externalSignalMap(context.asset),
    nextDataUpgrades: nextDataUpgrades(context.asset),
    autoTradeGate: gate,
    sourceSafety: {
      externalArticleUsedAsTextOnly: true,
      noExternalCodeExecuted: true,
      noSecretsTouched: true,
      noPaymentsTouched: true
    }
  };
}
