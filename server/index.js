// API server, and in production also the web app. No dependencies: uses Node's built-in modules.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { repoRoot } from "./env.js";
import { usage } from "./llm.js";
import { intake } from "./agents/intake.js";
import { gap } from "./agents/gap.js";
import { importResume } from "./agents/import.js";
import { profileChat } from "./agents/orchestrator.js";
import { matchJobs } from "./agents/matcher.js";
import { scorecard } from "./agents/scorecard.js";
import { coach } from "./agents/coach.js";

const PORT = process.env.PORT || 3001;
const WEB_DIR = resolve(repoRoot, "app", "dist"); // built by `npm run build`
const MAX_BODY = 8 * 1024 * 1024; // 8 MB: room for a resume photo or PDF

// Safety: limit model calls per visitor so a public link can't burn through the course key.
const RATE = { perHour: Number(process.env.RATE_PER_HOUR || 120) };
const hits = new Map();
function allowed(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3600e3);
  if (recent.length >= RATE.perHour) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error("Upload too large (8 MB max)."), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

const routes = {
  "GET /api/health": async () => ({ ok: true }),
  "GET /api/usage": async () => usage,
  "POST /api/intake": async (req) => intake(await readJson(req)),
  "POST /api/gap": async (req) => gap(await readJson(req)),
  "POST /api/import": async (req) => importResume(await readJson(req)),
  "POST /api/profile-chat": async (req) => profileChat(await readJson(req)),
  "POST /api/match": async (req) => matchJobs(await readJson(req)),
  "POST /api/scorecard": async (req) => scorecard(await readJson(req)),
  "POST /api/coach": async (req) => coach(await readJson(req)),
};

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".ttf": "font/ttf", ".woff2": "font/woff2" };

// Serves the built web app; unknown paths get index.html so the app can load.
function serveWeb(req, res) {
  if (!existsSync(WEB_DIR)) return send(res, 404, { error: "Web app not built. Run npm run build." });
  const path = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  let file = join(WEB_DIR, path);
  if (!file.startsWith(WEB_DIR) || !existsSync(file) || statSync(file).isDirectory()) file = join(WEB_DIR, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(req.method === "HEAD" ? undefined : readFileSync(file));
}

createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const path = req.url.split("?")[0];
  if (!path.startsWith("/api/")) return ["GET", "HEAD"].includes(req.method) ? serveWeb(req, res) : send(res, 404, { error: "Not found" });

  const handler = routes[`${req.method} ${path}`];
  if (!handler) return send(res, 404, { error: "Not found" });
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (req.method === "POST" && !allowed(ip)) {
    return send(res, 429, { error: "You've reached the hourly limit. Please try again in a little while." });
  }
  try {
    send(res, 200, await handler(req));
  } catch (err) {
    if (err.status === 413) res.shouldKeepAlive = false; // unread upload data would break the next request
    send(res, err.status || 500, { error: err.message });
  }
}).listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));
