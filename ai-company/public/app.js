const state = {
  assets: [],
  analysis: null
};

const elements = {
  status: document.querySelector("#status"),
  assetSelect: document.querySelector("#assetSelect"),
  providerSelect: document.querySelector("#providerSelect"),
  analyzeButton: document.querySelector("#analyzeButton"),
  direction: document.querySelector("#direction"),
  confidence: document.querySelector("#confidence"),
  entryPrice: document.querySelector("#entryPrice"),
  stopLoss: document.querySelector("#stopLoss"),
  takeProfit: document.querySelector("#takeProfit"),
  explanation: document.querySelector("#explanation"),
  reasons: document.querySelector("#reasons"),
  warnings: document.querySelector("#warnings"),
  tournament: document.querySelector("#tournament"),
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

function renderAssets() {
  const groups = [...new Set(state.assets.map((asset) => asset.group))];
  elements.assetSelect.innerHTML = groups.map((group) => {
    const options = state.assets
      .filter((asset) => asset.group === group)
      .map((asset) => `<option value="${asset.symbol}">${asset.symbol} - ${asset.name}</option>`)
      .join("");
    return `<optgroup label="${group}">${options}</optgroup>`;
  }).join("");
  elements.assetSelect.value = "XAUUSD";
}

function listItems(target, items) {
  target.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

function renderTournament(rows) {
  elements.tournament.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.name}</td>
      <td>${row.direction}</td>
      <td>${row.confidence}</td>
      <td>${row.trades}</td>
      <td>${row.winRate}%</td>
      <td>${row.netReturn}%</td>
      <td>${row.maxDrawdown}%</td>
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
    elements.explanation.textContent = analysis.reason;
    listItems(elements.reasons, []);
    listItems(elements.warnings, [analysis.reason]);
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
  elements.explanation.textContent = signal.explanation;
  listItems(elements.reasons, signal.reasons);
  listItems(elements.warnings, signal.warnings);
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

async function analyze() {
  elements.analyzeButton.disabled = true;
  setStatus("分析中");
  try {
    const symbol = elements.assetSelect.value;
    const provider = elements.providerSelect.value;
    state.analysis = await requestJson(`/api/analyze?symbol=${encodeURIComponent(symbol)}&provider=${provider}`);
    renderAnalysis(state.analysis);
    setStatus(`${symbol} 完了`);
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
  await analyze();
}

init().catch((error) => {
  setStatus("起動失敗");
  elements.explanation.textContent = error.message;
});
