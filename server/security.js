// Security: who is calling, what we saw, and the booby traps. See security/README.md for the three levels of defense.
//
// Code level: every suspicious request and every trap is written to an append-only security log
// (server/logs/security.jsonl, and the host's console), with the caller's address hashed so the log holds no raw IPs.
// A caller who springs a trap is flagged and blocked from the app's API for 24 hours.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { repoRoot } from "./env.js";

const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
// A secret that is stable across restarts but never in the repo: derived from the model key, or set SECURITY_SECRET.
const SECRET = process.env.SECURITY_SECRET || sha(`foresight-security:${process.env.PORTKEY_API_KEY || randomBytes(16).toString("hex")}`);
const secretCode = (name, n = 10) => sha(`${SECRET}:${name}`).slice(0, n);

// ---- Who is calling ----
// On Render the site sits behind Cloudflare, which sets CF-Connecting-IP to the real visitor and rejects visitors who
// try to send it themselves. X-Forwarded-For is NOT trusted: anyone can put a fake address at the front of it, which
// let an attacker skip the hourly limit (red-team test P3). Locally there is no proxy, so the socket address is used.
// TRUSTED_IP_HEADER overrides the header (tests use it to play the part of Cloudflare).
const TRUSTED = (process.env.TRUSTED_IP_HEADER || (process.env.RENDER ? "cf-connecting-ip" : "")).toLowerCase();
export function clientIp(req) {
  const fromProxy = TRUSTED ? req.headers[TRUSTED] : null;
  return String(fromProxy || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}
// The log and the block list use a hash, never the raw address.
export const clientId = (req) => sha(`${SECRET}:ip:${clientIp(req)}`).slice(0, 12);

// ---- The security log ----
const LOG = process.env.SECURITY_LOG || resolve(repoRoot, "server", "logs", "security.jsonl");
const recent = []; // the last 500 events, for the admin view
export function record({ rule, severity = "low", req, session, route, detail = "", action = "logged" }) {
  const event = { at: new Date().toISOString(), rule, severity, client: req ? clientId(req) : undefined, session: session || undefined,
    route: route || (req ? `${req.method} ${req.url.split("?")[0]}` : undefined), detail: String(detail).replace(/\s+/g, " ").slice(0, 300), action };
  recent.push(event);
  if (recent.length > 500) recent.shift();
  try { mkdirSync(dirname(LOG), { recursive: true }); appendFileSync(LOG, `${JSON.stringify(event)}\n`); } catch {}
  console.warn(`[security] ${event.severity} ${event.rule} ${event.route || ""} client=${event.client || "-"} ${event.detail}`);
  return event;
}
export const recentEvents = () => [...recent];

// ---- Flagged attackers ----
const flagged = new Map(); // client id -> { until, reason }
export function flag(req, reason) {
  flagged.set(clientId(req), { until: Date.now() + 24 * 3600e3, reason });
}
export function isFlagged(req) {
  const f = flagged.get(clientId(req));
  if (f && f.until < Date.now()) flagged.delete(clientId(req));
  return !!(f && f.until >= Date.now());
}
// A trap was sprung: log it at high severity and block the caller.
export function trap(req, rule, detail) {
  flag(req, rule);
  return record({ rule, severity: "high", req, detail, action: "flagged and blocked for 24 hours" });
}

// ---- Booby traps: values no real user ever sees ----
// Each trap has a hidden goal it catches. The values are generated from the secret, so they are not in the repo.
export const HONEY = {
  // B3: a canary code hidden in every coach's instructions. It only reaches a reply if the prompt is leaked.
  canary: `FS-CANARY-${secretCode("canary", 8).toUpperCase()}`,
  // B4: a fake model key that only the bait .env files show. Anyone who sends it back stole it.
  apiKey: `pk-live-${secretCode("apikey", 32)}`,
  // B2: fake accounts that only the bait admin export shows. Any sign-in with them is an attacker.
  accounts: [
    { email: `ops-export-${secretCode("acct1", 6)}@foresight-admin.example`, name: "Operations Export", password_reset_temp: `Temp-${secretCode("pw1", 12)}` },
    { email: `records-${secretCode("acct2", 6)}@foresight-admin.example`, name: "Records Admin", password_reset_temp: `Temp-${secretCode("pw2", 12)}` },
  ],
};
export const isHoneyEmail = (email) => HONEY.accounts.some((a) => a.email === String(email || "").trim().toLowerCase());

// B1: bait. robots.txt "hides" an admin area; following it is something only an attacker does.
export const ROBOTS = "User-agent: *\nDisallow: /api/admin/\nDisallow: /.env.backup\n";
export const BAIT_PATHS = ["/api/admin", "/api/admin/", "/api/admin/export", "/api/admin/users", "/.env", "/.env.backup", "/.git/config", "/server/data/accounts.local.json"];
export function baitBody(path) {
  if (path.startsWith("/api/admin")) {
    return { type: "json", body: { exported_at: new Date().toISOString(), note: "Nightly account export. Internal use only.",
      accounts: HONEY.accounts.map((a) => ({ ...a, status: "active", role: "admin" })) } };
  }
  return { type: "text", body: `# backup ${new Date().toISOString().slice(0, 10)}\nPORTKEY_API_KEY=${HONEY.apiKey}\nDATABASE_URL=postgres://export:${secretCode("dbpw", 16)}@db.internal.example:5432/foresight\n` };
}

// ---- Code-level detection: phrases attackers use ----
// Logged, not blocked: a real job seeker might write some of these words, so one hit alone is never punished.
const PATTERNS = [
  ["ask-for-others-data", /\b(other|previous|last|all|every)\s+(users?|applicants?|job ?seekers?|people|persons?|accounts?|candidates?)\b|\bperson (you|before me)\b|\bthe (database|user list)\b/i],
  ["prompt-injection", /\bignore (all |your |the |previous |any )*(instructions|rules|prompts?)\b|\bsystem (override|update|prompt|message)\b|\bdeveloper mode\b|\bjailbreak\b|\byou are now\b|\bact as (an? )?(admin|administrator|developer)\b/i],
  ["prompt-extraction", /\b(repeat|reveal|print|show|read back|translate|summari[sz]e)\b.{0,40}\b(instructions|system prompt|your rules|everything above|initial prompt)\b/i],
  ["claimed-authority", /\b(i am|i'm) (the |a )?(site |foresight )?(admin|administrator|developer|owner)\b|\bhr (has )?verified\b|\bvisible to the (ai|scoring system) only\b/i],
  ["secrets", /\b(api[ _-]?key|password|database url|\.env)\b/i],
];
export function scan(text) {
  const t = String(text || "");
  return PATTERNS.filter(([, re]) => re.test(t)).map(([name]) => name);
}

// ---- Design level: contact details a coach was never given are removed from its reply ----
// A coach only knows the one applicant in front of it, so any email or phone number in a reply that the request didn't
// contain is either another person's or invented. Either way it is removed and logged.
const CONTACT = /[\w.+-]+@[\w-]+\.[\w.-]+|\(?\b\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g;
export function redactContacts(value, allowedText, onHit) {
  const allowed = new Set([...String(allowedText).matchAll(CONTACT)].map((m) => m[0].toLowerCase()));
  const walk = (v) => {
    if (typeof v === "string") return v.replace(CONTACT, (m) => (allowed.has(m.toLowerCase()) ? m : (onHit(m), "[removed]")));
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value);
}
