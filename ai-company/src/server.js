import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeSymbol, listAssets, researchRoadmap } from "./analyzer.js";

const rootDir = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const port = Number(process.env.PORT || 3000);

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
    response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
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
  if (request.method === "GET" && url.pathname === "/api/analyze") {
    const symbol = url.searchParams.get("symbol") || "XAUUSD";
    const provider = url.searchParams.get("provider") || "demo";
    sendJson(response, 200, await analyzeSymbol(symbol, { provider }));
    return;
  }
  if (request.method === "POST" && url.pathname === "/api/analyze") {
    const body = await readBody(request);
    sendJson(response, 200, await analyzeSymbol(body.symbol || "XAUUSD", { provider: body.provider || "demo" }));
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
