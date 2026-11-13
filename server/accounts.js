// Accounts: optional sign-in so an applicant's profile, settings, and application tracker follow them
// to any device. Without an account, everything stays on the device as before.
//
// Storage: a Postgres database when DATABASE_URL is set (the live site uses a free Neon database), otherwise
// a local file (server/data/accounts.local.json), so the app runs from a fresh clone with no setup.
// Render's free servers lose their files on every restart, so on Render, accounts turn on only with a database.
//
// Security: passwords are hashed with scrypt and a random salt (never stored or logged as text).
// Sign-in gives the device a random token; only a SHA-256 hash of it is stored, and it expires after 60 days.
// Repeated wrong passwords for one email are slowed down. Applicants can delete their account and data.
import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { promisify } from "node:util";
import "./env.js";

const scrypt = promisify(scryptCb);
const SESSION_DAYS = 60;
const MAX_DATA = 1024 * 1024; // 1 MB of saved data per applicant is far more than a profile and tracker need
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

// ---- Storage ----
// ACCOUNTS_FILE lets tests (server/eval/redteam.js) use a throwaway file instead of the real local accounts.
const FILE = process.env.ACCOUNTS_FILE ? new URL(`file://${process.env.ACCOUNTS_FILE}`) : new URL("./data/accounts.local.json", import.meta.url);

function fileStore() {
  const db = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { next: 1, accounts: [], sessions: {}, saved: {} };
  const write = () => { writeFileSync(`${FILE.pathname}.tmp`, JSON.stringify(db)); renameSync(`${FILE.pathname}.tmp`, FILE); };
  return {
    kind: "file",
    async createAccount(email, hash) {
      if (db.accounts.some((a) => a.email === email)) return null;
      const id = db.next++;
      db.accounts.push({ id, email, hash, created: new Date().toISOString() });
      write();
      return id;
    },
    async findAccount(email) { return db.accounts.find((a) => a.email === email) || null; },
    async addSession(tokenHash, id, expires) { db.sessions[tokenHash] = { id, expires: expires.toISOString() }; write(); },
    async sessionAccount(tokenHash) {
      const s = db.sessions[tokenHash];
      if (!s || new Date(s.expires) < new Date()) return null;
      const a = db.accounts.find((x) => x.id === s.id);
      return a ? { id: a.id, email: a.email } : null;
    },
    async dropSession(tokenHash) { delete db.sessions[tokenHash]; write(); },
    async getSaved(id) { return db.saved[id] || null; },
    async putSaved(id, data) { db.saved[id] = { data, updated_at: new Date().toISOString() }; write(); return db.saved[id].updated_at; },
    async deleteAccount(id) {
      db.accounts = db.accounts.filter((a) => a.id !== id);
      for (const [k, s] of Object.entries(db.sessions)) if (s.id === id) delete db.sessions[k];
      delete db.saved[id];
      write();
    },
  };
}

async function pgStore(url) {
  const { default: pg } = await import("pg"); // installed by the root build step; only needed with a database
  const pool = new pg.Pool({ connectionString: url, max: 3, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  const q = (text, params) => pool.query(text, params).then((r) => r.rows);
  await q(`CREATE TABLE IF NOT EXISTS accounts (id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS saved (account_id BIGINT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  return {
    kind: "database",
    async createAccount(email, hash) {
      const rows = await q("INSERT INTO accounts (email, pass_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id", [email, hash]);
      return rows[0] ? Number(rows[0].id) : null;
    },
    async findAccount(email) {
      const [a] = await q("SELECT id, email, pass_hash AS hash FROM accounts WHERE email = $1", [email]);
      return a ? { ...a, id: Number(a.id) } : null;
    },
    async addSession(tokenHash, id, expires) {
      await q("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, id, expires]);
      await q("DELETE FROM sessions WHERE expires_at < now()"); // tidy up old sign-ins
    },
    async sessionAccount(tokenHash) {
      const [a] = await q("SELECT a.id, a.email FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token_hash = $1 AND s.expires_at > now()", [tokenHash]);
      return a ? { id: Number(a.id), email: a.email } : null;
    },
    async dropSession(tokenHash) { await q("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]); },
    async getSaved(id) {
      const [r] = await q("SELECT data, updated_at FROM saved WHERE account_id = $1", [id]);
      return r ? { data: r.data, updated_at: new Date(r.updated_at).toISOString() } : null;
    },
    async putSaved(id, data) {
      const [r] = await q(`INSERT INTO saved (account_id, data, updated_at) VALUES ($1, $2, now())
        ON CONFLICT (account_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now() RETURNING updated_at`, [id, data]);
      return new Date(r.updated_at).toISOString();
    },
    async deleteAccount(id) { await q("DELETE FROM accounts WHERE id = $1", [id]); },
  };
}

let storePromise;
function store() {
  storePromise ??= process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL)
    : process.env.RENDER ? Promise.resolve(null) // no database on Render: accounts stay off rather than lose data
    : Promise.resolve(fileStore());
  return storePromise.then((s) => s || Promise.reject(fail("Accounts are not turned on for this site yet.", 503)));
}
export const accountsEnabled = () => !!(process.env.DATABASE_URL || !process.env.RENDER);

// ---- Passwords and tokens ----
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
async function checkPassword(password, stored) {
  const [, salt, key] = String(stored).split("$");
  const want = Buffer.from(key || "", "base64");
  const got = await scrypt(password, Buffer.from(salt || "", "base64"), 64);
  return want.length === got.length && timingSafeEqual(want, got);
}
const sha = (t) => createHash("sha256").update(t).digest("hex");

// Slow down password guessing: after 8 wrong tries for one email, wait 15 minutes.
const failures = new Map();
const lockedOut = (email) => (failures.get(email) || []).filter((t) => Date.now() - t < 15 * 60e3).length >= 8;
const noteFailure = (email) => failures.set(email, [...(failures.get(email) || []), Date.now()].slice(-8));

function cleanCredentials({ email, password } = {}) {
  email = String(email || "").trim().toLowerCase();
  password = String(password || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw fail("Enter a valid email address.");
  if (password.length < 8) throw fail("Your password needs at least 8 characters.");
  if (password.length > 200) throw fail("That password is too long.");
  return { email, password };
}

async function startSession(s, account) {
  const token = randomBytes(32).toString("base64url");
  await s.addSession(sha(token), account.id, new Date(Date.now() + SESSION_DAYS * 86400e3));
  const saved = await s.getSaved(account.id);
  return { token, email: account.email, saved };
}

export async function signUp(body) {
  const { email, password } = cleanCredentials(body);
  const s = await store();
  const id = await s.createAccount(email, await hashPassword(password));
  if (!id) throw fail("An account with that email already exists. Sign in instead.", 409);
  return startSession(s, { id, email });
}

export async function signIn(body) {
  const { email, password } = cleanCredentials(body);
  if (lockedOut(email)) throw fail("Too many tries. Wait 15 minutes, then try again.", 429);
  const s = await store();
  const account = await s.findAccount(email);
  // Same message whether the email or the password was wrong, so the form can't be used to find out who has an account.
  if (!account || !(await checkPassword(password, account.hash))) {
    noteFailure(email);
    throw fail("That email and password don't match. Try again.", 401);
  }
  failures.delete(email);
  return startSession(s, account);
}

// The signed-in account for a request, from its "Authorization: Bearer <token>" header.
async function who(req) {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
  const s = await store();
  const account = token ? await s.sessionAccount(sha(token)) : null;
  if (!account) throw fail("Please sign in again.", 401);
  return { s, account, token };
}

export async function signOut(req) {
  const { s, token } = await who(req);
  await s.dropSession(sha(token));
  return { ok: true };
}

export async function getMine(req) {
  const { s, account } = await who(req);
  return { email: account.email, saved: await s.getSaved(account.id) };
}

export async function saveMine(req, body) {
  const { s, account } = await who(req);
  const data = { profile: body.profile || {}, prefs: body.prefs || {}, tracker: Array.isArray(body.tracker) ? body.tracker : [] };
  if (JSON.stringify(data).length > MAX_DATA) throw fail("That's more data than an account can hold.", 413);
  return { updated_at: await s.putSaved(account.id, data) };
}

export async function deleteMine(req) {
  const { s, account } = await who(req);
  await s.deleteAccount(account.id);
  return { deleted: true };
}
