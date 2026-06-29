import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSymbol, listAssets, researchRoadmap } from "./analyzer.js";
import { readLearningSummary, runDailyLearning } from "./learning.js";
import { startAutoLearningScheduler } from "./learningScheduler.js";

const rootDir = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const port = Number(process.env.PORT || 3000);
const learningScheduler = startAutoLearningScheduler();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const rawPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(rootDir, safePath);
  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(content);
  } catch {
    sendJson(response, 404, { ok: false, error: "Not found" });
  }
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/api/assets") {
    sendJson(response, 200, { ok: true, assets: listAssets() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/research/roadmap") {
    sendJson(response, 200, { ok: true, roadmap: researchRoadmap() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/learn/summary") {
    sendJson(response, 200, { ok: true, summary: await readLearningSummary() });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/learn/scheduler") {
    sendJson(response, 200, { ok: true, scheduler: learningScheduler.state });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/learn/daily") {
    const body = await readBody(request);
    const provider = body.provider || url.searchParams.get("provider") || "demo";
    const interval = body.interval || url.searchParams.get("interval") || "1d";
    sendJson(response, 200, { ok: true, summary: await runDailyLearning({ provider, intervals: [interval] }) });
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/analyze") {
    const symbol = url.searchParams.get("symbol") || "XAUUSD";
    const provider = url.searchParams.get("provider") || "demo";
    const interval = url.searchParams.get("interval") || "1d";
    sendJson(response, 200, await analyzeSymbol(symbol, { provider, interval }));
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/scan") {
    const provider = url.searchParams.get("provider") || "demo";
    const interval = url.searchParams.get("interval") || "1d";
    const rows = [];
    for (const asset of listAssets()) {
      const result = await analyzeSymbol(asset.symbol, { provider, interval, includeContext: false });
      rows.push({
        symbol: asset.symbol,
        name: asset.name,
        group: asset.group,
        ok: result.ok,
        direction: result.signal?.direction ?? result.status,
        confidence: result.signal?.confidence ?? 0,
        regime: result.signal?.marketRegime?.name ?? "-",
        model: result.signal?.leadModel ?? "-",
        agreement: result.signal?.modelAgreement ?? 0,
        edgeScore: result.signal?.intelligence?.edgeScore ?? 0,
        autoTradeGate: result.signal?.intelligence?.autoTradeGate?.status ?? "-",
        marketLinkage: result.signal?.marketLinkage?.score ?? 0,
        eventRisk: result.signal?.eventFilter?.status ?? "-",
        quality: result.signal?.dataQuality?.score ?? result.dataQuality?.score ?? 0,
        costBps: result.signal?.costs?.totalBps ?? 0,
        reason: result.signal?.reasons?.[0] ?? result.reason
      });
    }
    rows.sort((a, b) => b.confidence - a.confidence);
    sendJson(response, 200, { ok: true, provider, interval, rows });
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/analyze") {
    const body = await readBody(request);
    sendJson(response, 200, await analyzeSymbol(body.symbol || "XAUUSD", { provider: body.provider || "demo", interval: body.interval || "1d" }));
    return;
  }
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true, service: "market-ai", status: "healthy" });
    return;
  }
  sendJson(response, 404, { ok: false, error: "Unknown API endpoint" });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/") || request.url === "/health") {
      await handleApi(request, response);
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Market AI app running at http://localhost:${port}`);
});
