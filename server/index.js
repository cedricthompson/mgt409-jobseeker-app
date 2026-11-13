// API server, and in production also the web app. No dependencies: uses Node's built-in modules.
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { repoRoot } from "./env.js";
import { modelStatus, usage } from "./llm.js";
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
import { timingSafeEqual } from "node:crypto";
import { recordClientEvent, recordServerEvent, summary } from "./stats.js";
import { BAIT_PATHS, HONEY, ROBOTS, baitBody, clientId, isFlagged, isHoneyEmail, recentEvents, record, redactContacts, scan, trap } from "./security.js";

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

// The body is read once (the security checks read it before the route does) and kept on the request.
async function readJson(req) {
  if (req.parsedBody !== undefined) return req.parsedBody;
  req.parsedBody = await readBody(req);
  return req.parsedBody;
}
async function readBody(req) {
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
    database: process.env.DATABASE_URL ? "set" : "missing", accounts: accountsEnabled(), sources: sourcesConfigured(), jsearch_quota: jsearchQuota, ...modelStatus(), last: sourceStatus }),
  // Totals only. Per-session numbers used to be public here, which showed anyone who else was using the app (red-team P1).
  "GET /api/usage": async () => ({ total: usage.total, byAgent: usage.byAgent }),
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
  "POST /api/event": async () => ({ ok: true }), // handled before the hourly limit (see below)
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

// Link previews (texts, email, LinkedIn, Facebook) and home-screen icons: the Chart Academy graphic with ForeSIGHT.
// Social sites need full addresses, so they're built from the address the page was requested at.
const SHARE = {
  title: "ForeSIGHT by Chart Academy",
  description: "Let us help you predict your future. Free AI career coaching that scores every job 0 to 100 and shows your real chances of an interview and an offer.",
};
function withShareTags(html, req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const site = `${proto}://${req.headers.host}`;
  const tags = [
    `<meta name="description" content="${SHARE.description}">`,
    `<meta property="og:type" content="website">`, `<meta property="og:site_name" content="ForeSIGHT">`,
    `<meta property="og:title" content="${SHARE.title}">`, `<meta property="og:description" content="${SHARE.description}">`,
    `<meta property="og:url" content="${site}/">`,
    `<meta property="og:image" content="${site}/share.png">`, `<meta property="og:image:width" content="1200">`, `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Chart Academy logo with ForeSIGHT: Let us help you predict your future.">`,
    `<meta name="twitter:card" content="summary_large_image">`, `<meta name="twitter:image" content="${site}/share.png">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`, `<meta name="theme-color" content="#3A56A6">`,
  ].join("");
  return html.replace("</head>", `${tags}</head>`);
}

// The owner check for /api/security-log and /api/stats. Off unless SECURITY_ADMIN_TOKEN is set.
// Wrong tokens are limited to 10 an hour per visitor, so the token can't be guessed by trying many.
const ownerMisses = new Map();
function isOwner(req) {
  const id = clientId(req), now = Date.now();
  const misses = (ownerMisses.get(id) || []).filter((t) => now - t < 3600e3);
  if (misses.length >= 10) return false;
  if (checkOwnerToken(req)) return true;
  ownerMisses.set(id, [...misses, now]);
  return false;
}
function checkOwnerToken(req) {
  const want = process.env.SECURITY_ADMIN_TOKEN || "";
  const got = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return !!want && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

// Usage events from the app: up to 600 an hour per visitor, far more than real use needs.
const eventHits = new Map();
function eventAllowed(id) {
  const now = Date.now();
  const recent = (eventHits.get(id) || []).filter((t) => now - t < 3600e3);
  if (recent.length >= 600) return false;
  eventHits.set(id, [...recent, now]);
  return true;
}

const sendText = (res, body) => { res.writeHead(200, { "Content-Type": "text/plain" }); res.end(body); };
const BLOCKED = { error: "This request was blocked." };

// Sign-up and sign-in get their own, tighter limit: "an account with that email already exists" would otherwise let
// someone test thousands of emails to learn who uses ForeSIGHT (red-team P2).
const ACCOUNT_LIMIT = { "/api/signup": 5, "/api/login": 10 };
const accountHits = new Map();
function accountAllowed(id, path) {
  const key = `${path}:${id}`, now = Date.now();
  const recentTries = (accountHits.get(key) || []).filter((t) => now - t < 3600e3);
  if (recentTries.length >= ACCOUNT_LIMIT[path]) return false;
  accountHits.set(key, [...recentTries, now]);
  return true;
}

// The text a person typed or uploaded in a request, for the attack-phrase scan (not images, not whole job lists).
function typedText(b = {}) {
  return [...(Array.isArray(b.messages) ? b.messages.filter((m) => m?.role === "user").map((m) => m.content) : []),
    b.context, b.tracked?.notes, b.text, b.url, b.kind === "text" ? b.data : "", ...(b.profile?.target_roles || [])]
    .filter((x) => typeof x === "string").join("\n").slice(0, 20000);
}
// Replies from these coaches are checked for contact details the request didn't contain (see security.js).
const REDACT = new Set(["/api/profile-chat", "/api/intake", "/api/gap", "/api/coach"]);

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const path = req.url.split("?")[0];
  let plainPath = path;
  try { plainPath = decodeURIComponent(path); } catch {}

  // Booby traps B1 and B4: bait files and a bait admin area that the app never links to. Only an attacker asks for them.
  if (path === "/robots.txt") return sendText(res, ROBOTS);
  if (plainPath.startsWith("/api/admin") || BAIT_PATHS.includes(plainPath)) {
    trap(req, plainPath.startsWith("/api/admin") ? "trap-admin-bait" : "trap-bait-file", plainPath);
    const bait = baitBody(plainPath);
    return bait.type === "json" ? send(res, 200, bait.body) : sendText(res, bait.body);
  }
  // The owner's stats page. It holds no data itself: it asks for the admin token, then reads /api/stats.
  if (path === "/stats" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "text/html", "X-Robots-Tag": "noindex", "Cache-Control": "no-store" });
    return res.end(readFileSync(resolve(repoRoot, "server", "stats.html")));
  }
  if (!path.startsWith("/api/")) return ["GET", "HEAD"].includes(req.method) ? serveWeb(req, res) : send(res, 404, { error: "Not found" });

  // The owner's view of the security log. Off unless SECURITY_ADMIN_TOKEN is set; a wrong token looks like "not found".
  if (path === "/api/security-log" && req.method === "GET") {
    if (!isOwner(req)) { record({ rule: "security-log-probe", severity: "medium", req }); return send(res, 404, { error: "Not found" }); }
    return send(res, 200, { events: recentEvents() });
  }
  // The owner's anonymous usage totals (read by the /stats page), locked with the same token.
  if (path === "/api/stats" && req.method === "GET") {
    if (!isOwner(req)) { record({ rule: "stats-probe", severity: "medium", req }); return send(res, 404, { error: "Not found" }); }
    try { return send(res, 200, await summary(new URL(req.url, "http://x").searchParams.get("days"))); }
    catch (err) { console.error("Stats failed:", err.message); return send(res, 500, { error: "Stats are unavailable right now." }); }
  }

  const handler = routes[`${req.method} ${path}`];
  if (!handler) return send(res, 404, { error: "Not found" });
  const id = clientId(req);
  if (isFlagged(req)) {
    record({ rule: "blocked-flagged-client", severity: "medium", req, action: "refused (403)" });
    return send(res, 403, BLOCKED);
  }
  // Usage counts from the app have their own, roomier limit so they never use up a visitor's coaching requests.
  if (path === "/api/event") {
    if (!eventAllowed(id)) return send(res, 429, { error: "Too many events." });
    try { recordClientEvent(await readJson(req)); } catch { /* not counted */ }
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && !allowed(id)) {
    record({ rule: "hourly-limit", severity: "low", req, action: "refused (429)" });
    return send(res, 429, { error: "You've reached the hourly limit. Please try again in a little while." });
  }
  if (ACCOUNT_LIMIT[path] && !accountAllowed(id, path)) {
    record({ rule: "account-probing", severity: "medium", req, action: "refused (429)" });
    return send(res, 429, { error: "Too many tries. Please wait an hour and try again." });
  }
  try {
    const body = ["POST", "PUT"].includes(req.method) ? await readJson(req) : undefined;
    // Booby trap B4: the fake model key from the bait .env files, sent back anywhere in the request.
    if (JSON.stringify(body ?? "").includes(HONEY.apiKey) || JSON.stringify(req.headers).includes(HONEY.apiKey)) {
      trap(req, "trap-honey-key", "the fake API key from a bait file was sent back");
      return send(res, 403, BLOCKED);
    }
    // Booby trap B2: a sign-in with an account that only exists in the bait admin export. Looks like a normal wrong password.
    if (path === "/api/login" && isHoneyEmail(body?.email)) {
      trap(req, "trap-honey-login", "sign-in with a honey account from the bait export");
      return send(res, 401, { error: "That email and password don't match. Try again." });
    }
    const typed = typedText(body);
    const rules = typed ? scan(typed) : [];
    if (rules.length) record({ rule: `suspicious-input:${rules.join("+")}`, req, session: body?.session, detail: typed.slice(0, 200) });

    let out = await handler(req);
    if (REDACT.has(path)) {
      out = redactContacts(out, JSON.stringify(body ?? ""), (m) =>
        record({ rule: "contact-in-reply", severity: "medium", req, session: body?.session, detail: `removed ${m.replace(/.(?=.{4})/g, "*")}`, action: "removed from reply" }));
    }
    recordServerEvent(path, body);
    send(res, 200, out);
  } catch (err) {
    if (err.status === 413) res.shouldKeepAlive = false; // unread upload data would break the next request
    // Booby trap B3: a coach's reply contained the canary hidden in its instructions, so the prompt was being leaked.
    if (err.code === "canary") {
      trap(req, "trap-prompt-canary", `canary in ${err.agent} reply`);
      return send(res, 400, { error: "I can't help with that, but I'm happy to keep working on your job search." });
    }
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
