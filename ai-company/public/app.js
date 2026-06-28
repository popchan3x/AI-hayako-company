const state = {
  assets: [],
  analysis: null
};

const elements = {
  status: document.querySelector("#status"),
  assetSelect: document.querySelector("#assetSelect"),
  providerSelect: document.querySelector("#providerSelect"),
  analyzeButton: document.querySelector("#analyzeButton"),
  scanButton: document.querySelector("#scanButton"),
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
  explanation: document.querySelector("#explanation"),
  reasons: document.querySelector("#reasons"),
  warnings: document.querySelector("#warnings"),
  scenarios: document.querySelector("#scenarios"),
  riskSummary: document.querySelector("#riskSummary"),
  tournament: document.querySelector("#tournament"),
  scanTable: document.querySelector("#scanTable"),
  xDraft: document.querySelector("#xDraft"),
  chart: document.querySelector("#priceChart")
};

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
      <td>${escapeHtml(row.quality)}/100</td>
      <td>${escapeHtml(row.costBps)}bp</td>
    </tr>
  `).join("");
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
    elements.explanation.textContent = analysis.reason;
    listItems(elements.reasons, []);
    listItems(elements.warnings, [analysis.reason]);
    listItems(elements.scenarios, []);
    listItems(elements.riskSummary, analysis.dataQuality?.issues || []);
    elements.tournament.innerHTML = "";
    elements.xDraft.value = "";
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
  elements.explanation.textContent = signal.explanation;
  listItems(elements.reasons, signal.reasons);
  listItems(elements.warnings, signal.warnings);
  listItems(elements.scenarios, signal.scenarios);
  listItems(elements.riskSummary, signal.riskSummary);
  renderTournament(analysis.tournament);
  elements.xDraft.value = signal.xDraft;
  drawChart(analysis.candles);
}

function drawChart(candles) {
  const canvas = elements.chart;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fbfcf9";
  context.fillRect(0, 0, width, height);
  if (!candles.length) return;

  const closes = candles.map((candle) => candle.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const pad = Math.max((max - min) * 0.08, max * 0.001);
  const scaleY = (price) => height - 24 - ((price - min + pad) / (max - min + pad * 2)) * (height - 48);
  const scaleX = (index) => 18 + (index / (candles.length - 1)) * (width - 36);

  context.strokeStyle = "#d9ded3";
  context.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = 24 + i * ((height - 48) / 3);
    context.beginPath();
    context.moveTo(12, y);
    context.lineTo(width - 12, y);
    context.stroke();
  }

  context.strokeStyle = "#2f7d5b";
  context.lineWidth = 3;
  context.beginPath();
  closes.forEach((close, index) => {
    const x = scaleX(index);
    const y = scaleY(close);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();

  context.fillStyle = "#1f261f";
  context.font = "18px Segoe UI";
  context.fillText(String(closes.at(-1).toFixed(closes.at(-1) < 2 ? 5 : 2)), width - 120, scaleY(closes.at(-1)) - 8);
}

async function scanAll() {
  elements.scanButton.disabled = true;
  setStatus("全体スキャン中");
  try {
    const provider = elements.providerSelect.value;
    const payload = await requestJson(`/api/scan?provider=${provider}`);
    renderScan(payload.rows);
    setStatus(`全体スキャン完了 ${payload.rows.length}件`);
  } catch (error) {
    setStatus("スキャン失敗");
    elements.explanation.textContent = error.message;
  } finally {
    elements.scanButton.disabled = false;
  }
}

async function analyze() {
  elements.analyzeButton.disabled = true;
  setStatus("分析中");
  try {
    const symbol = elements.assetSelect.value;
    const provider = elements.providerSelect.value;
    state.analysis = await requestJson(`/api/analyze?symbol=${encodeURIComponent(symbol)}&provider=${provider}`);
    renderAnalysis(state.analysis);
    setStatus(`${symbol} 分析完了`);
  } catch (error) {
    setStatus("失敗");
    elements.explanation.textContent = error.message;
  } finally {
    elements.analyzeButton.disabled = false;
  }
}

async function init() {
  const payload = await requestJson("/api/assets");
  state.assets = payload.assets;
  renderAssets();
  elements.analyzeButton.addEventListener("click", analyze);
  elements.scanButton.addEventListener("click", scanAll);
  await analyze();
  await scanAll();
}

init().catch((error) => {
  setStatus("起動失敗");
  elements.explanation.textContent = error.message;
});
