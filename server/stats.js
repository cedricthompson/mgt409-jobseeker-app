// Anonymous usage statistics: how many people use ForeSIGHT, how far they get, and what they are looking for.
//
// Privacy: no names, emails, IP addresses, resumes, or chat text are stored here. Each event has the random
// visit id the app makes when it opens (app/api.ts, a new one every visit), an event name from a fixed list, and a
// few coarse details (a city, an education level, a pay band, job titles they want). Browsers that send the
// Global Privacy Control signal are not counted at all. Events older than RETENTION_DAYS are deleted.
//
// Storage: Postgres when DATABASE_URL is set (the live site), otherwise in memory (local runs and tests).
// The owner reads the totals at /stats, locked with SECURITY_ADMIN_TOKEN (see index.js).
import "./env.js";

const RETENTION_DAYS = 400;

// Events the app may send itself (POST /api/event). Anything else is ignored.
export const CLIENT_EVENTS = new Set(["visit", "start", "screen", "tracker_add", "tracker_move"]);
// Events the server records when a request succeeds, so they count even if the app's own report is lost.
export const SERVER_EVENTS = {
  "/api/import": "resume_import", "/api/profile-chat": "profile_chat", "/api/match": "matches",
  "/api/scorecard": "scorecard", "/api/coach": "coach", "/api/check-job": "check_job", "/api/signup": "signup",
};

const clip = (v, n = 60) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, n) : undefined);
const SCREENS = new Set(["welcome", "import", "chat", "matches", "tracker", "coach", "settings", "check", "account", "score"]);
const STAGES = new Set(["Saved", "Applied", "Screening", "Interviewing", "Offer", "Closed"]);
const METHODS = new Set(["resume", "linkedin", "photo", "speak", "button"]); // the four start cards (app/start.ts), or the plain "Get started" button

// Only known, short values from the app are kept.
function cleanClientProps(name, p = {}) {
  if (name === "visit") return { returning: p.returning === true, platform: clip(p.platform, 12) };
  if (name === "start") return { method: METHODS.has(p.method) ? p.method : "button" };
  if (name === "screen") return SCREENS.has(p.screen) ? { screen: p.screen } : null;
  if (name === "tracker_add" || name === "tracker_move") return STAGES.has(p.stage) ? { stage: p.stage } : null;
  return null;
}

// Pay comes in as "$22/hour", "55000", "60k", and so on. It is kept only as a yearly band.
export function payBand(v) {
  const s = String(v ?? "").toLowerCase().replace(/,/g, "");
  const m = s.match(/(\d+(?:\.\d+)?)\s*(k)?/);
  if (!m) return undefined;
  let n = Number(m[1]) * (m[2] ? 1000 : 1);
  if (/hour|hr|\/h/.test(s) || n < 200) n *= 2080; // hourly pay, full time
  if (!n) return undefined;
  const bands = [[30000, "Under $30k"], [40000, "$30k to $40k"], [50000, "$40k to $50k"], [65000, "$50k to $65k"], [80000, "$65k to $80k"]];
  return (bands.find(([top]) => n < top) || [0, "$80k or more"])[1];
}

const textOf = (v) => (typeof v === "string" ? v : v && typeof v === "object" ? (v.level ?? v.highest ?? v.degree ?? Object.values(v)[0]) : undefined);

// The few profile details worth counting, taken when someone reaches their job matches.
export function profileSummary(p = {}) {
  const roles = (Array.isArray(p.target_roles) ? p.target_roles : typeof p.target_roles === "string" ? p.target_roles.split(/[,;]/) : [])
    .map((r) => clip(String(r), 40)?.toLowerCase()).filter(Boolean).slice(0, 3);
  const edu = Array.isArray(p.education) ? textOf(p.education[0]) : textOf(p.education);
  return {
    city: clip(textOf(p.city), 40),
    education: clip(typeof edu === "string" ? edu : undefined, 40),
    pay_band: payBand(p.target_pay),
    work_mode: clip(textOf(p.work_mode), 20)?.toLowerCase(),
    commute_mode: clip(textOf(p.commute_mode), 20)?.toLowerCase(),
    roles,
  };
}

let backend;
async function store() {
  backend ??= (async () => {
    if (process.env.DATABASE_URL) {
      try {
        const { default: pg } = await import("pg");
        const url = process.env.DATABASE_URL;
        const pool = new pg.Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
        await pool.query(`CREATE TABLE IF NOT EXISTS events (id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(),
          visit TEXT NOT NULL, name TEXT NOT NULL, props JSONB NOT NULL DEFAULT '{}');
          CREATE INDEX IF NOT EXISTS events_at ON events (at);`);
        await pool.query(`DELETE FROM events WHERE at < now() - interval '${RETENTION_DAYS} days'`);
        return {
          async add(e) { await pool.query("INSERT INTO events (visit, name, props) VALUES ($1, $2, $3)", [e.visit, e.name, e.props]); },
          async since(days) {
            const { rows } = await pool.query(`SELECT at, visit, name, props FROM events WHERE at > now() - make_interval(days => $1) ORDER BY at LIMIT 300000`, [days]);
            return rows;
          },
        };
      } catch (err) {
        console.error("Usage stats: database unavailable, counting in memory.", err.message);
      }
    }
    const events = [];
    return {
      async add(e) { events.push({ ...e, at: new Date() }); if (events.length > 50000) events.shift(); },
      async since(days) { const from = Date.now() - days * 86400e3; return events.filter((e) => e.at.getTime() > from); },
    };
  })();
  return backend;
}

// Counting must never break the app: errors are ignored.
async function add(visit, name, props) {
  if (typeof visit !== "string" || !/^[a-z0-9]{4,20}$/.test(visit)) return;
  try { await (await store()).add({ visit, name, props: props || {} }); } catch { /* not counted */ }
}

export function recordClientEvent(body = {}) {
  if (body.track === false || !CLIENT_EVENTS.has(body.name)) return;
  const props = cleanClientProps(body.name, body.props);
  if (props) add(body.session, body.name, props);
}

export function recordServerEvent(path, body = {}) {
  const name = SERVER_EVENTS[path];
  if (!name || body.track === false) return;
  // Sign-ups come from the account screen, which doesn't send a visit id; they get a one-off id so they still count.
  const visit = typeof body.session === "string" ? body.session : Math.random().toString(36).slice(2);
  add(visit, name, name === "matches" ? profileSummary(body.profile) : {});
}

// ---- Totals for the owner's stats page ----
const top = (counts, n = 10) => Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, count]) => ({ label, count }));
const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

export async function summary(days = 30) {
  days = Math.min(Math.max(Number(days) || 30, 1), RETENTION_DAYS);
  const rows = await (await store()).since(days);
  const byVisit = new Map(); // visit id -> set of event names
  const daily = {};
  const visitInfo = new Map();
  const tally = { start: {}, screen: {}, city: {}, education: {}, pay_band: {}, work_mode: {}, commute_mode: {}, roles: {}, stage: {} };
  const events = {};
  for (const r of rows) {
    const set = byVisit.get(r.visit) || new Set();
    set.add(r.name);
    if (r.props?.stage === "Applied") set.add("applied");
    byVisit.set(r.visit, set);
    events[r.name] = (events[r.name] || 0) + 1;
    const day = new Date(r.at).toISOString().slice(0, 10);
    (daily[day] ??= new Set()).add(r.visit);
    const p = r.props || {};
    if (r.name === "visit") visitInfo.set(r.visit, p);
    if (r.name === "start") tally.start[p.method] = (tally.start[p.method] || 0) + 1;
    if (r.name === "screen") tally.screen[p.screen] = (tally.screen[p.screen] || 0) + 1;
    if (r.name === "tracker_move" || r.name === "tracker_add") tally.stage[p.stage] = (tally.stage[p.stage] || 0) + 1;
    if (r.name === "matches") {
      // One profile per visit: the last one wins, so asking for matches twice doesn't count the person twice.
      visitInfo.set(`${r.visit}:profile`, p);
    }
  }
  for (const [key, p] of visitInfo) {
    if (!key.endsWith(":profile")) continue;
    for (const f of ["education", "pay_band", "work_mode", "commute_mode"]) if (p[f]) tally[f][p[f]] = (tally[f][p[f]] || 0) + 1;
    if (p.city) { const c = titleCase(p.city.toLowerCase()); tally.city[c] = (tally.city[c] || 0) + 1; }
    for (const role of p.roles || []) tally.roles[role] = (tally.roles[role] || 0) + 1;
  }
  // A sign-up on its own isn't a visit (it has a one-off id); every other event comes from someone using the app.
  const opened = [...byVisit.values()].filter((s) => [...s].some((n) => n !== "signup")).length;
  const reached = (names) => [...byVisit.values()].filter((s) => names.some((n) => s.has(n))).length;
  const visits = [...visitInfo.entries()].filter(([k]) => !k.includes(":"));
  return {
    days,
    generated: new Date().toISOString(),
    visits: opened,
    new_visits: visits.filter(([, p]) => !p.returning).length,
    returning_visits: visits.filter(([, p]) => p.returning).length,
    // How far people get, counted once per visit.
    funnel: [
      { step: "Opened the app", visits: opened },
      { step: "Started a profile", visits: reached(["start", "resume_import", "profile_chat"]) },
      { step: "Talked with a coach", visits: reached(["profile_chat"]) },
      { step: "Saw job matches", visits: reached(["matches"]) },
      { step: "Got a Predictability Score", visits: reached(["scorecard"]) },
      { step: "Saved a job to the tracker", visits: reached(["tracker_add"]) },
      { step: "Marked a job as applied", visits: reached(["applied"]) },
      { step: "Got resume or cover letter help", visits: reached(["coach"]) },
    ],
    other: { checked_a_job: reached(["check_job"]), created_an_account: events.signup || 0 },
    daily: Object.entries(daily).sort().map(([day, set]) => ({ day, visits: set.size })),
    start_methods: top(tally.start),
    screens: top(tally.screen),
    tracker_stages: top(tally.stage),
    profiles: {
      counted: [...visitInfo.keys()].filter((k) => k.endsWith(":profile")).length,
      cities: top(tally.city), education: top(tally.education), pay_bands: top(tally.pay_band),
      work_modes: top(tally.work_mode), commute_modes: top(tally.commute_mode), target_roles: top(tally.roles, 15),
    },
  };
}
