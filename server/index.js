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
import { checkJob } from "./agents/jobreader.js";
import { accountsEnabled, deleteMine, getMine, saveMine, signIn, signOut, signUp } from "./accounts.js";
import { jsearchQuota, prefetchJobs, sourceStatus, sourcesConfigured } from "./sources.js";

const PORT = process.env.PORT || 3001;
const STARTED = new Date().toISOString(); // shown by /api/health, to confirm a restart picked up new settings
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_BODY) throw Object.assign(new Error("Upload too large (8 MB max)."), { status: 413 });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { throw Object.assign(new Error("The request wasn't valid JSON."), { status: 400 }); }
}

const routes = {
  "GET /api/health": async () => ({ ok: true, started: STARTED, version: (process.env.RENDER_GIT_COMMIT || "local").slice(0, 7),
    database: process.env.DATABASE_URL ? "set" : "missing", accounts: accountsEnabled(), sources: sourcesConfigured(), jsearch_quota: jsearchQuota, last: sourceStatus }),
  "GET /api/usage": async () => usage,
  "POST /api/intake": async (req) => intake(await readJson(req)),
  "POST /api/gap": async (req) => gap(await readJson(req)),
  "POST /api/import": async (req) => importResume(await readJson(req)),
  "POST /api/profile-chat": async (req) => {
    const r = await profileChat(await readJson(req));
    prefetchJobs(r.profile); // warm the job search cache before the applicant opens matches
    return r;
  },
  "POST /api/match": async (req) => matchJobs(await readJson(req)),
  "POST /api/scorecard": async (req) => scorecard(await readJson(req)),
  "POST /api/coach": async (req) => coach(await readJson(req)),
  "POST /api/check-job": async (req) => checkJob(await readJson(req)),
  // Accounts (optional): saved profile, settings, and tracker on any device.
  "POST /api/signup": async (req) => signUp(await readJson(req)),
  "POST /api/login": async (req) => signIn(await readJson(req)),
  "POST /api/logout": async (req) => signOut(req),
  "GET /api/me": async (req) => getMine(req),
  "PUT /api/me": async (req) => saveMine(req, await readJson(req)),
  "DELETE /api/me": async (req) => deleteMine(req),
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
  if (req.method === "HEAD") return res.end();
  res.end(file.endsWith("index.html") ? withShareTags(readFileSync(file, "utf8"), req) : readFileSync(file));
}

// Link previews (texts, email, LinkedIn, Facebook) and home-screen icons: the Chart Academy graphic with Foresight.
// Social sites need full addresses, so they're built from the address the page was requested at.
const SHARE = {
  title: "Foresight by Chart Academy",
  description: "Let us help you predict your future. Free AI career coaching that scores every job 0 to 100 and shows your real chances of an interview and an offer.",
};
function withShareTags(html, req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const site = `${proto}://${req.headers.host}`;
  const tags = [
    `<meta name="description" content="${SHARE.description}">`,
    `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="Foresight">`,
    `<meta property="og:title" content="${SHARE.title}">`, `<meta property="og:description" content="${SHARE.description}">`,
    `<meta property="og:url" content="${site}/">`,
    `<meta property="og:image" content="${site}/share.png">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Chart Academy logo with Foresight: Let us help you predict your future.">`,
    `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:image" content="${site}/share.png">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<meta name="theme-color" content="#3A56A6">`,
  ].join("");
  return html.replace("</head>", `${tags}</head>`);
}

const server = createServer(async (req, res) => {
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
    if (!err.status) console.error(`${req.method} ${path} failed:`, err.message);
    send(res, err.status || 500, { error: err.message });
  }
});

// Render's proxy keeps connections to the app open and reuses them. Node's default 5-second idle
// timeout closed them first, so a reused connection was reset (seen as dropped requests and 502s).
// Idle connections now stay open longer than the proxy's, and headersTimeout must exceed keepAliveTimeout.
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;
server.listen(PORT, () => console.log(`Running at http://localhost:${PORT}`));

// A stray promise rejection is logged instead of crashing the server for everyone.
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));
