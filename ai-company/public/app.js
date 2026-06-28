const state = {
  assets: [],
  analysis: null,
  timeframe: "1h",
  chartHoverIndex: null
};

const elements = {
  status: document.querySelector("#status"),
  assetSelect: document.querySelector("#assetSelect"),
  providerSelect: document.querySelector("#providerSelect"),
  timeframeTabs: document.querySelector("#timeframeTabs"),
  providerHelp: document.querySelector("#providerHelp"),
  analyzeButton: document.querySelector("#analyzeButton"),
  scanButton: document.querySelector("#scanButton"),
  learnButton: document.querySelector("#learnButton"),
  externalChart: document.querySelector("#externalChart"),
  externalChartStatus: document.querySelector("#externalChartStatus"),
  direction: document.querySelector("#direction"),
  confidence: document.querySelector("#confidence"),
  entryPrice: document.querySelector("#entryPrice"),
  stopLoss: document.querySelector("#stopLoss"),
  takeProfit: document.querySelector("#takeProfit"),
  regime: document.querySelector("#regime"),
  selectedModel: document.querySelector("#selectedModel"),
  modelAgreement: document.querySelector("#modelAgreement"),
  dataQuality: document.querySelector("#dataQuality"),
  tradingCost: document.querySelector("#tradingCost"),
  voteWeights: document.querySelector("#voteWeights"),
  intelligenceScore: document.querySelector("#intelligenceScore"),
  readinessScore: document.querySelector("#readinessScore"),
  intelligenceVerdict: document.querySelector("#intelligenceVerdict"),
  autoTradeGate: document.querySelector("#autoTradeGate"),
  factorScores: document.querySelector("#factorScores"),
  blindSpots: document.querySelector("#blindSpots"),
  dataUpgrades: document.querySelector("#dataUpgrades"),
  externalSignals: document.querySelector("#externalSignals"),
  materialTimeframe: document.querySelector("#materialTimeframe"),
  materialSummary: document.querySelector("#materialSummary"),
  materialCards: document.querySelector("#materialCards"),
  strategyPlaybook: document.querySelector("#strategyPlaybook"),
  explanation: document.querySelector("#explanation"),
  reasons: document.querySelector("#reasons"),
  warnings: document.querySelector("#warnings"),
  scenarios: document.querySelector("#scenarios"),
  riskSummary: document.querySelector("#riskSummary"),
  tournament: document.querySelector("#tournament"),
  scanTable: document.querySelector("#scanTable"),
  learningSignals: document.querySelector("#learningSignals"),
  learningOutcomes: document.querySelector("#learningOutcomes"),
  learningPending: document.querySelector("#learningPending"),
  learningNewSignals: document.querySelector("#learningNewSignals"),
  learningActions: document.querySelector("#learningActions"),
  xDraft: document.querySelector("#xDraft"),
  chart: document.querySelector("#priceChart")
};

const TRADING_VIEW_OVERRIDES = {
  SPY: "AMEX:SPY",
  QQQ: "NASDAQ:QQQ",
  DIA: "AMEX:DIA",
  IWM: "AMEX:IWM",
  VTI: "AMEX:VTI",
  RSP: "AMEX:RSP",
  SMH: "NASDAQ:SMH",
  SOXX: "NASDAQ:SOXX",
  TLT: "NASDAQ:TLT",
  HYG: "AMEX:HYG",
  VIXY: "AMEX:VIXY",
  EWJ: "AMEX:EWJ",
  DXJ: "AMEX:DXJ",
  NVDA: "NASDAQ:NVDA",
  AAPL: "NASDAQ:AAPL",
  MSFT: "NASDAQ:MSFT",
  AMZN: "NASDAQ:AMZN",
  GOOGL: "NASDAQ:GOOGL",
  META: "NASDAQ:META",
  TSLA: "NASDAQ:TSLA",
  AVGO: "NASDAQ:AVGO",
  AMD: "NASDAQ:AMD",
  TSM: "NYSE:TSM",
  ASML: "NASDAQ:ASML",
  ORCL: "NYSE:ORCL",
  PLTR: "NASDAQ:PLTR",
  JPM: "NYSE:JPM",
  BAC: "NYSE:BAC",
  XOM: "NYSE:XOM",
  CVX: "NYSE:CVX",
  LLY: "NYSE:LLY",
  UNH: "NYSE:UNH",
  COST: "NASDAQ:COST",
  GLD: "AMEX:GLD",
  SLV: "AMEX:SLV",
  PPLT: "AMEX:PPLT",
  PALL: "AMEX:PALL",
  GDX: "AMEX:GDX",
  GDXJ: "AMEX:GDXJ",
  NEM: "NYSE:NEM",
  GOLD: "NYSE:GOLD",
  AEM: "NYSE:AEM",
  PAAS: "NYSE:PAAS",
  WPM: "NYSE:WPM"
};

const FX_SYMBOLS = new Set([
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
]);

const TRADING_VIEW_INTERVALS = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D"
};

const TIMEFRAME_LABELS = {
  "1m": "1分",
  "5m": "5分",
  "15m": "15分",
  "1h": "1時間",
  "4h": "4時間",
  "1d": "日足"
};

function resolveTradingViewSymbol(symbol) {
  const normalized = String(symbol || "").toUpperCase();
  if (TRADING_VIEW_OVERRIDES[normalized]) return TRADING_VIEW_OVERRIDES[normalized];
  if (FX_SYMBOLS.has(normalized)) return `FX:${normalized}`;
  if (/^X(AU|AG|PT|PD)USD$/.test(normalized)) return `OANDA:${normalized}`;
  if (/^\d{4}JP$/.test(normalized)) return `TSE:${normalized.replace("JP", "")}`;
  return `NASDAQ:${normalized}`;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function setStatus(text) {
  elements.status.textContent = text;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAssets() {
  const groups = [...new Set(state.assets.map((asset) => asset.group))];
  elements.assetSelect.innerHTML = groups.map((group) => {
    const options = state.assets
      .filter((asset) => asset.group === group)
      .map((asset) => `<option value="${escapeHtml(asset.symbol)}">${escapeHtml(asset.symbol)} - ${escapeHtml(asset.name)}</option>`)
      .join("");
    return `<optgroup label="${escapeHtml(group)}">${options}</optgroup>`;
  }).join("");
  elements.assetSelect.value = "XAUUSD";
}

function renderProviderHelp() {
  const value = elements.providerSelect.value;
  const help = {
    demo: "ローカルで作る仮の価格データです。画面確認、モデル検証、操作練習用で、実際の相場価格ではありません。",
    "free-composite": "Stooqを先に試し、取れなければYahooを試します。両方失敗した場合は推測せず分析不可にします。",
    "free-stooq": "Stooqだけを使います。土日でも過去の日足が取れることはありますが、通信失敗なら分析不可です。",
    "free-yahoo": "Yahoo Financeだけを使います。FXや貴金属は無料で取れる代替シンボルを使う場合があります。"
  };
  elements.providerHelp.textContent = help[value] || help.demo;
}

function renderTimeframeTabs() {
  elements.timeframeTabs.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.timeframe === state.timeframe);
  });
}

function listItems(target, items) {
  target.innerHTML = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderTournament(rows) {
  elements.tournament.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.direction)}</td>
      <td>${escapeHtml(row.confidence)}</td>
      <td>${escapeHtml(row.trades)}</td>
      <td>${escapeHtml(row.winRate)}%</td>
      <td>${escapeHtml(row.expectancy)}%</td>
      <td>${escapeHtml(row.payoffRatio)}</td>
      <td>${escapeHtml(row.netReturn)}%</td>
      <td>${escapeHtml(row.maxDrawdown)}%</td>
      <td>${escapeHtml(row.maxLossStreak)}</td>
      <td>${escapeHtml(row.score)}</td>
    </tr>
  `).join("");
}

function renderScan(rows) {
  elements.scanTable.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.symbol)}</td>
      <td>${escapeHtml(row.direction)}</td>
      <td>${escapeHtml(row.confidence)}/100</td>
      <td>${escapeHtml(row.regime)}</td>
      <td>${escapeHtml(row.model)}</td>
      <td>${escapeHtml(row.agreement)}%</td>
      <td>${escapeHtml(row.edgeScore)}/100</td>
      <td>${escapeHtml(row.autoTradeGate)}</td>
      <td>${escapeHtml(row.quality)}/100</td>
      <td>${escapeHtml(row.costBps)}bp</td>
    </tr>
  `).join("");
}

function renderLearning(summary) {
  elements.learningSignals.textContent = summary.totals.signals;
  elements.learningOutcomes.textContent = summary.totals.outcomes;
  elements.learningPending.textContent = summary.totals.pendingOutcomes;
  elements.learningNewSignals.textContent = summary.totals.newSignals;
  listItems(elements.learningActions, summary.nextActions || []);
}

function renderFactorScores(factors) {
  elements.factorScores.innerHTML = factors.map((factor) => `
    <div class="factor">
      <div class="factor-head">
        <strong>${escapeHtml(factor.name)}</strong>
        <span>${escapeHtml(factor.score)}/100</span>
      </div>
      <div class="factor-bar" aria-hidden="true">
        <span style="width: ${Math.max(0, Math.min(100, factor.score))}%"></span>
      </div>
      <p>${escapeHtml(factor.detail)}</p>
    </div>
  `).join("");
}

function renderExternalSignals(items) {
  elements.externalSignals.innerHTML = items.map((item) => `
    <tr>
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(item.use)}</td>
    </tr>
  `).join("");
}

function renderAnalysisMaterials(materials) {
  if (!materials) {
    elements.materialTimeframe.textContent = "-";
    elements.materialSummary.innerHTML = "";
    elements.materialCards.innerHTML = "";
    elements.strategyPlaybook.innerHTML = "";
    return;
  }
  elements.materialTimeframe.textContent = materials.timeframe?.label || TIMEFRAME_LABELS[state.timeframe] || state.timeframe;
  elements.materialSummary.innerHTML = (materials.summary || [])
    .map((item) => `<p>${escapeHtml(item)}</p>`)
    .join("");
  elements.materialCards.innerHTML = (materials.cards || []).map((card) => `
    <article class="material-card">
      <header>
        <strong>${escapeHtml(card.name)}</strong>
        <span>${escapeHtml(card.score)}/100</span>
      </header>
      <div class="material-meter" aria-hidden="true">
        <i style="width: ${Math.max(0, Math.min(100, card.score))}%"></i>
      </div>
      <p>${escapeHtml(card.detail)}</p>
    </article>
  `).join("");
  listItems(elements.strategyPlaybook, materials.playbook || []);
}

function renderExternalChart(symbol) {
  if (!elements.externalChart) return;
  const tradingViewSymbol = resolveTradingViewSymbol(symbol);
  elements.externalChartStatus.textContent = `${tradingViewSymbol} / ${TIMEFRAME_LABELS[state.timeframe] || state.timeframe}`;
  elements.externalChart.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "tradingview-widget-container";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";

  const widget = document.createElement("div");
  widget.className = "tradingview-widget-container__widget";
  widget.style.height = "100%";
  widget.style.width = "100%";

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.textContent = JSON.stringify({
    autosize: true,
    symbol: tradingViewSymbol,
    interval: TRADING_VIEW_INTERVALS[state.timeframe] || "60",
    timezone: "Asia/Tokyo",
    theme: "dark",
    style: "1",
    locale: "ja",
    allow_symbol_change: true,
    save_image: true,
    calendar: false,
    support_host: "https://www.tradingview.com",
    withdateranges: true,
    hide_side_toolbar: false,
    hide_top_toolbar: false,
    details: true,
    hotlist: false
  });
  script.addEventListener("error", () => {
    elements.externalChartStatus.textContent = `${tradingViewSymbol} 読込失敗`;
  });

  wrapper.append(widget, script);
  elements.externalChart.append(wrapper);
}

function clearIntelligence() {
  elements.intelligenceScore.textContent = "-";
  elements.readinessScore.textContent = "-";
  elements.intelligenceVerdict.textContent = "-";
  elements.autoTradeGate.textContent = "-";
  elements.factorScores.innerHTML = "";
  listItems(elements.blindSpots, []);
  listItems(elements.dataUpgrades, []);
  elements.externalSignals.innerHTML = "";
}

function renderAnalysis(analysis) {
  if (!analysis.ok) {
    elements.direction.textContent = analysis.status;
    elements.confidence.textContent = "-";
    elements.entryPrice.textContent = "-";
    elements.stopLoss.textContent = "-";
    elements.takeProfit.textContent = "-";
    elements.regime.textContent = "-";
    elements.selectedModel.textContent = "-";
    elements.modelAgreement.textContent = "-";
    elements.dataQuality.textContent = analysis.dataQuality ? `${analysis.dataQuality.grade} ${analysis.dataQuality.score}/100` : "-";
    elements.tradingCost.textContent = "-";
    elements.voteWeights.textContent = "-";
    clearIntelligence();
    elements.explanation.textContent = analysis.reason;
    listItems(elements.reasons, []);
    listItems(elements.warnings, [analysis.reason]);
    listItems(elements.scenarios, []);
    listItems(elements.riskSummary, analysis.dataQuality?.issues || []);
    elements.tournament.innerHTML = "";
    elements.xDraft.value = "";
    renderAnalysisMaterials(null);
    drawChart([]);
    return;
  }

  const signal = analysis.signal;
  elements.direction.textContent = signal.direction;
  elements.confidence.textContent = `${signal.confidence}/100`;
  elements.entryPrice.textContent = signal.entryPrice;
  elements.stopLoss.textContent = signal.stopLoss;
  elements.takeProfit.textContent = signal.takeProfit;
  elements.regime.textContent = signal.marketRegime.name;
  elements.selectedModel.textContent = signal.selectedModel;
  elements.modelAgreement.textContent = `${signal.modelAgreement}%`;
  elements.dataQuality.textContent = `${signal.dataQuality.grade} ${signal.dataQuality.score}/100`;
  elements.tradingCost.textContent = `${signal.costs.totalBps}bp`;
  elements.voteWeights.textContent = `買${signal.voteWeights.buy}% / 売${signal.voteWeights.sell}% / 待${signal.voteWeights.wait}%`;
  elements.intelligenceScore.textContent = `${signal.intelligence.edgeScore}/100`;
  elements.readinessScore.textContent = `${signal.intelligence.readinessScore}/100`;
  elements.intelligenceVerdict.textContent = signal.intelligence.verdict;
  elements.autoTradeGate.textContent = signal.intelligence.autoTradeGate.status;
  renderFactorScores(signal.intelligence.factors);
  listItems(elements.blindSpots, signal.intelligence.blindSpots);
  listItems(elements.dataUpgrades, signal.intelligence.nextDataUpgrades);
  renderExternalSignals(signal.intelligence.externalSignals);
  elements.explanation.textContent = signal.explanation;
  listItems(elements.reasons, signal.reasons);
  listItems(elements.warnings, signal.warnings);
  listItems(elements.scenarios, signal.scenarios);
  listItems(elements.riskSummary, signal.riskSummary);
  renderTournament(analysis.tournament);
  elements.xDraft.value = signal.xDraft;
  renderAnalysisMaterials(analysis.analysisMaterials);
  drawChart(analysis.candles, signal);
}

function formatPrice(value) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) < 2) return value.toFixed(5);
  if (Math.abs(value) < 100) return value.toFixed(3);
  return value.toFixed(2);
}

function formatChartDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: state.timeframe === "1d" ? undefined : "2-digit",
    minute: state.timeframe === "1d" ? undefined : "2-digit"
  }).format(date);
}

function movingAverage(values, period) {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const slice = values.slice(index + 1 - period, index + 1);
    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function drawPriceLine(context, price, label, color, layout, scaleY) {
  if (!Number.isFinite(price)) return;
  const y = scaleY(price);
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1;
  context.setLineDash([7, 5]);
  context.beginPath();
  context.moveTo(layout.left, y);
  context.lineTo(layout.priceRight, y);
  context.stroke();
  context.setLineDash([]);
  context.font = "12px Segoe UI";
  const text = `${label} ${formatPrice(price)}`;
  const width = context.measureText(text).width + 14;
  context.fillRect(layout.priceRight + 8, y - 10, width, 20);
  context.fillStyle = "#ffffff";
  context.fillText(text, layout.priceRight + 15, y + 4);
  context.restore();
}

function drawChart(candles, signal = null) {
  const canvas = elements.chart;
  const context = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(760, Math.floor(rect.width || canvas.width));
  const height = Math.max(440, Math.floor(rect.height || canvas.height));

  if (canvas.width !== Math.floor(width * pixelRatio) || canvas.height !== Math.floor(height * pixelRatio)) {
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
  }

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#101820";
  context.fillRect(0, 0, width, height);
  if (!candles.length) {
    context.fillStyle = "#8fa1ad";
    context.font = "16px Segoe UI";
    context.fillText("価格データがありません", 28, 42);
    return;
  }

  const visibleCandles = candles.slice(-160);
  const closes = candles.map((candle) => candle.close);
  const lows = visibleCandles.map((candle) => candle.low ?? candle.close);
  const highs = visibleCandles.map((candle) => candle.high ?? candle.close);
  const volumes = visibleCandles.map((candle) => candle.volume || 0);
  const min = Math.min(...lows, signal?.stopLoss ?? Infinity, signal?.takeProfit ?? Infinity, signal?.entryPrice ?? Infinity);
  const max = Math.max(...highs, signal?.stopLoss ?? -Infinity, signal?.takeProfit ?? -Infinity, signal?.entryPrice ?? -Infinity);
  const pad = Math.max((max - min) * 0.08, max * 0.001);
  const layout = {
    left: 58,
    right: 18,
    top: 42,
    priceRight: width - 92,
    priceBottom: height - 116,
    volumeTop: height - 88,
    bottom: height - 32
  };
  state.chartGeometry = {
    left: layout.left,
    priceRight: layout.priceRight,
    visibleCandles
  };
  const priceHeight = layout.priceBottom - layout.top;
  const volumeHeight = layout.bottom - layout.volumeTop;
  const scaleY = (price) => layout.priceBottom - ((price - min + pad) / (max - min + pad * 2)) * priceHeight;
  const scaleX = (index) => {
    if (visibleCandles.length === 1) return layout.left + (layout.priceRight - layout.left) / 2;
    return layout.left + (index / (visibleCandles.length - 1)) * (layout.priceRight - layout.left);
  };
  const candleStep = Math.max(2, (layout.priceRight - layout.left) / Math.max(1, visibleCandles.length));
  const candleWidth = Math.max(3, Math.min(12, candleStep * 0.62));

  context.strokeStyle = "#23313d";
  context.lineWidth = 1;
  context.font = "12px Segoe UI";
  context.fillStyle = "#8fa1ad";
  for (let i = 0; i <= 5; i += 1) {
    const y = layout.top + i * (priceHeight / 5);
    const price = max + pad - i * ((max - min + pad * 2) / 5);
    context.beginPath();
    context.moveTo(layout.left, y);
    context.lineTo(layout.priceRight, y);
    context.stroke();
    context.fillText(formatPrice(price), layout.priceRight + 10, y + 4);
  }
  for (let i = 0; i <= 6; i += 1) {
    const x = layout.left + i * ((layout.priceRight - layout.left) / 6);
    context.beginPath();
    context.moveTo(x, layout.top);
    context.lineTo(x, layout.bottom);
    context.stroke();
  }

  const maxVolume = Math.max(...volumes, 1);
  visibleCandles.forEach((candle, index) => {
    const x = scaleX(index);
    const open = candle.open ?? candle.close;
    const close = candle.close;
    const high = candle.high ?? Math.max(open, close);
    const low = candle.low ?? Math.min(open, close);
    const isUp = close >= open;
    const color = isUp ? "#26a69a" : "#ef5350";
    const bodyTop = scaleY(Math.max(open, close));
    const bodyBottom = scaleY(Math.min(open, close));
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(x, scaleY(high));
    context.lineTo(x, scaleY(low));
    context.stroke();
    context.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

    const volumeHeightPx = (candle.volume || 0) / maxVolume * volumeHeight;
    context.globalAlpha = 0.42;
    context.fillRect(x - candleWidth / 2, layout.bottom - volumeHeightPx, candleWidth, volumeHeightPx);
    context.globalAlpha = 1;
  });

  const movingAverages = [
    { label: "MA20", values: movingAverage(closes, 20).slice(-160), color: "#f7c948" },
    { label: "MA50", values: movingAverage(closes, 50).slice(-160), color: "#5cc8ff" }
  ];
  movingAverages.forEach((average) => {
    context.strokeStyle = average.color;
    context.lineWidth = 1.6;
    context.beginPath();
    let started = false;
    average.values.forEach((value, index) => {
      if (!Number.isFinite(value)) return;
      const x = scaleX(index);
      const y = scaleY(value);
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
      }
    });
    if (started) context.stroke();
    context.fillStyle = average.color;
    context.fillText(average.label, layout.left + (average.label === "MA20" ? 0 : 58), 24);
  });

  drawPriceLine(context, signal?.entryPrice, "入口", "#f7c948", layout, scaleY);
  drawPriceLine(context, signal?.stopLoss, "損切り", "#ef5350", layout, scaleY);
  drawPriceLine(context, signal?.takeProfit, "利確", "#26a69a", layout, scaleY);

  const last = visibleCandles.at(-1);
  const lastClose = last.close;
  const lastY = scaleY(lastClose);
  context.strokeStyle = "#dce3ea";
  context.setLineDash([3, 4]);
  context.beginPath();
  context.moveTo(layout.left, lastY);
  context.lineTo(layout.priceRight, lastY);
  context.stroke();
  context.setLineDash([]);
  context.fillStyle = "#dce3ea";
  context.font = "13px Segoe UI";
  context.fillText(`現在値 ${formatPrice(lastClose)}`, layout.left, 24);

  const firstDate = new Date(visibleCandles.at(0).time);
  const lastDate = new Date(last.time);
  context.fillStyle = "#8fa1ad";
  context.font = "12px Segoe UI";
  context.fillText(firstDate.toLocaleDateString("ja-JP"), layout.left, height - 10);
  context.fillText(lastDate.toLocaleDateString("ja-JP"), layout.priceRight - 78, height - 10);
  context.fillText(`表示 ${visibleCandles.length}本 / ${TIMEFRAME_LABELS[state.timeframe] || "日足"}`, layout.left + 145, height - 10);

  context.strokeStyle = "#314454";
  context.strokeRect(layout.left, layout.top, layout.priceRight - layout.left, layout.priceBottom - layout.top);
  context.strokeRect(layout.left, layout.volumeTop, layout.priceRight - layout.left, layout.bottom - layout.volumeTop);

  if (Number.isInteger(state.chartHoverIndex) && visibleCandles[state.chartHoverIndex]) {
    const candle = visibleCandles[state.chartHoverIndex];
    const x = scaleX(state.chartHoverIndex);
    const y = scaleY(candle.close);
    context.strokeStyle = "#dce3ea";
    context.lineWidth = 1;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(x, layout.top);
    context.lineTo(x, layout.bottom);
    context.moveTo(layout.left, y);
    context.lineTo(layout.priceRight, y);
    context.stroke();
    context.setLineDash([]);

    const rows = [
      formatChartDate(candle.time),
      `始 ${formatPrice(candle.open)}  高 ${formatPrice(candle.high)}`,
      `安 ${formatPrice(candle.low)}  終 ${formatPrice(candle.close)}`,
      `出来高 ${new Intl.NumberFormat("ja-JP").format(candle.volume || 0)}`
    ];
    const boxWidth = 218;
    const boxHeight = 82;
    const boxX = x > layout.left + boxWidth + 28 ? x - boxWidth - 14 : x + 14;
    const boxY = Math.max(layout.top + 10, Math.min(layout.priceBottom - boxHeight - 10, y - 42));
    context.fillStyle = "rgba(16, 24, 32, 0.94)";
    context.fillRect(boxX, boxY, boxWidth, boxHeight);
    context.strokeStyle = "#44586a";
    context.strokeRect(boxX, boxY, boxWidth, boxHeight);
    context.fillStyle = "#dce3ea";
    context.font = "12px Segoe UI";
    rows.forEach((row, index) => {
      context.fillText(row, boxX + 12, boxY + 18 + index * 17);
    });
  }
}

window.addEventListener("resize", () => {
  if (state.analysis?.ok) {
    drawChart(state.analysis.candles, state.analysis.signal);
  }
});

function updateChartHover(event) {
  const geometry = state.chartGeometry;
  if (!geometry?.visibleCandles?.length || !state.analysis?.ok) return;
  const rect = elements.chart.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const ratio = (x - geometry.left) / Math.max(1, geometry.priceRight - geometry.left);
  const index = Math.round(ratio * (geometry.visibleCandles.length - 1));
  state.chartHoverIndex = Math.max(0, Math.min(geometry.visibleCandles.length - 1, index));
  drawChart(state.analysis.candles, state.analysis.signal);
}

function clearChartHover() {
  state.chartHoverIndex = null;
  if (state.analysis?.ok) drawChart(state.analysis.candles, state.analysis.signal);
}

async function scanAll() {
  elements.scanButton.disabled = true;
  setStatus("全体スキャン中");
  try {
    const provider = elements.providerSelect.value;
    const payload = await requestJson(`/api/scan?provider=${provider}&interval=${state.timeframe}`);
    renderScan(payload.rows);
    setStatus(`全体スキャン完了 ${payload.rows.length}件`);
  } catch (error) {
    setStatus("スキャン失敗");
    elements.explanation.textContent = error.message;
  } finally {
    elements.scanButton.disabled = false;
  }
}

async function loadLearningSummary() {
  const payload = await requestJson("/api/learn/summary");
  renderLearning(payload.summary);
}

async function runDailyLearning() {
  elements.learnButton.disabled = true;
  setStatus("日次学習中");
  try {
    const provider = elements.providerSelect.value;
    const payload = await requestJson(`/api/learn/daily?provider=${provider}&interval=${state.timeframe}`, { method: "POST" });
    renderLearning(payload.summary);
    setStatus(`日次学習完了 ${payload.summary.totals.newSignals}件追加`);
  } catch (error) {
    setStatus("学習失敗");
    elements.explanation.textContent = error.message;
  } finally {
    elements.learnButton.disabled = false;
  }
}

async function analyze() {
  elements.analyzeButton.disabled = true;
  setStatus("分析中");
  try {
    const symbol = elements.assetSelect.value;
    const provider = elements.providerSelect.value;
    renderExternalChart(symbol);
    state.analysis = await requestJson(`/api/analyze?symbol=${encodeURIComponent(symbol)}&provider=${provider}&interval=${state.timeframe}`);
    renderAnalysis(state.analysis);
    setStatus(`${symbol} 分析完了`);
  } catch (error) {
    setStatus("失敗");
    elements.explanation.textContent = error.message;
  } finally {
    elements.analyzeButton.disabled = false;
  }
}

async function changeTimeframe(timeframe) {
  if (!TIMEFRAME_LABELS[timeframe] || state.timeframe === timeframe) return;
  state.timeframe = timeframe;
  state.chartHoverIndex = null;
  renderTimeframeTabs();
  await analyze();
}

async function init() {
  const payload = await requestJson("/api/assets");
  state.assets = payload.assets;
  renderAssets();
  renderProviderHelp();
  renderTimeframeTabs();
  elements.analyzeButton.addEventListener("click", analyze);
  elements.scanButton.addEventListener("click", scanAll);
  elements.learnButton.addEventListener("click", runDailyLearning);
  elements.chart.addEventListener("mousemove", updateChartHover);
  elements.chart.addEventListener("mouseleave", clearChartHover);
  elements.assetSelect.addEventListener("change", () => renderExternalChart(elements.assetSelect.value));
  elements.timeframeTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-timeframe]");
    if (button) changeTimeframe(button.dataset.timeframe);
  });
  elements.providerSelect.addEventListener("change", renderProviderHelp);
  await loadLearningSummary();
  await analyze();
  await scanAll();
}

init().catch((error) => {
  setStatus("起動失敗");
  elements.explanation.textContent = error.message;
});
