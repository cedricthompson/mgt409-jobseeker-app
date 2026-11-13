// Live job sources. Each is optional: if its key is missing or the request fails,
// it returns [] and the app falls back to the sample dataset.
// Every source returns jobs in the same shape as data/sample-jobs.json.
import "./env.js";
import { readFileSync } from "node:fs";
import { geocode, metroFor } from "./geo.js";
import { totalYears } from "./experience.js";
import { feedJobs } from "./feeds.js";
import { relatedTitles } from "./onet.js";

const LIMIT = 8;

// Job searches are cached for an hour (job boards don't change minute to minute),
// which keeps us well under each source's free daily limit. Kept in memory only (URLs can contain keys), never written to disk.
const SEARCH_TTL = 3600e3;
const searchCache = new Map();
// Searches still running, so a match request that arrives during a background prefetch
// (see prefetchJobs) waits for that search instead of starting a second one.
const inFlight = new Map();
// `before` runs (and is awaited) only when a real request is about to go out, never for a cached answer;
// `onResponse` sees every real response, including errors.
async function getJson(url, { ttl = SEARCH_TTL, before, onResponse, ...options } = {}, ms = 6000) {
  const hit = searchCache.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  if (inFlight.has(url)) return inFlight.get(url);
  const request = (async () => {
    await before?.();
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
    onResponse?.(res);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
    const data = await res.json();
    searchCache.set(url, { at: Date.now(), data });
    return data;
  })().finally(() => inFlight.delete(url));
  inFlight.set(url, request);
  return request;
}
const timeout = () => AbortSignal.timeout(6000);

// What each source did last time (shown by /api/health so a missing key or failing source is easy to spot).
// Only yes/no, counts, and error messages; never keys.
export const sourceStatus = {};
const note = (name, result, error) => { sourceStatus[name] = { at: new Date().toISOString(), jobs: result, error: error || null }; };
export function sourcesConfigured() {
  const e = process.env;
  return { usajobs: !!(e.USAJOBS_API_KEY && e.USAJOBS_EMAIL), adzuna: !!(e.ADZUNA_APP_ID && e.ADZUNA_APP_KEY), jsearch: !!e.JSEARCH_API_KEY, employers: !!e.JSEARCH_API_KEY, feeds: true, remotive: true };
}
const firstRole = (p) => (p.target_roles || [])[0] || (p.experience || [])[0]?.title || "";

// Every role worth searching, the applicant's own job ideas first (the titles they told Theo they want),
// then up to three target roles and the most recent job title. Repeats (any capitalization) are dropped.
export const searchRoles = (p) => {
  const seen = new Set();
  return [...(p.job_interests?.titles || []), ...(p.target_roles || []).slice(0, 3), (p.experience || [])[0]?.title]
    .filter(Boolean).map((r) => String(r).trim()).filter((r) => r && !seen.has(r.toLowerCase()) && seen.add(r.toLowerCase()));
};

// Kinds of workplace to search near the applicant (Theo asks which they want). Without a preference: hospitals,
// which hire for nearly every kind of job, plus IT companies when the applicant's roles or skills are in tech.
const IT_WORK = /\b(it|tech|technician|computer|help ?desk|desktop|network|software|developer|data|cyber|systems|cloud|support specialist)\b/i;
const NO_PREFERENCE = /^(any|anywhere|no preference|none|not sure|open|anything)$/i;
export function workplaces(p) {
  const chosen = (p.job_interests?.workplaces || []).map((w) => String(w).trim()).filter((w) => w && !NO_PREFERENCE.test(w));
  if (chosen.length) return chosen.slice(0, 3);
  return IT_WORK.test([...searchRoles(p), ...(p.skills || [])].join(" ")) ? ["hospital", "IT company"] : ["hospital"];
}

// Someone starting out (no jobs listed, or under a year in total) gets entry-level searches too,
// so first-job seekers see fast food, retail, and "hiring now" openings.
export const isEntryLevel = (p) => {
  const jobs = p.experience || [];
  if (!jobs.length) return true;
  // Jobs listed without years don't count as "starting out"; only a known total under a year does.
  // totalYears reads date ranges like "March 2014–July 2015" too (Number() of those was 0).
  return jobs.every((e) => e.years != null && e.years !== "") && totalYears(jobs) < 1;
};
const ENTRY_SEARCHES = ["fast food crew member", "hiring immediately no experience"];

// Postings that say they hire quickly: open interviews, immediate start, hired on the spot.
const HIRING_NOW = /hiring immediately|immediate(ly)? (start|hire|hiring)|start (today|immediately|asap|right away)|on[- ]the[- ]spot|walk[- ]?in|open interview|same[- ]day (offer|hire|interview)|hiring event|now hiring|apply today,? start/i;
export const markHiringNow = (j) => ({ ...j, hiring_now: HIRING_NOW.test(`${j.title} ${j.summary || ""}`) });
const wantsRemote = (p) => /remote|any|hybrid|open/i.test(p.work_mode || "");

// Job boards search best on a plain "City, ST", so a neighborhood or street is reduced to its metro.
async function searchPlace(city) {
  return metroFor(await geocode(city))?.search || city || "";
}

// USAJobs (federal jobs). Free key: https://developer.usajobs.gov/apirequest/
// Searches both the target role and the most recent job title, so entry-level roles show up too.
export async function usajobs(p, roles = searchRoles(p)) {
  const { USAJOBS_API_KEY: key, USAJOBS_EMAIL: email } = process.env;
  if (!key || !email) return [];
  const keywords = roles.slice(0, 2);
  const where = await searchPlace(p.city);
  const results = await Promise.all(keywords.map((k) => usajobsSearch(k, where, key, email)));
  const seen = new Set();
  return results.flat().filter((j) => !seen.has(j.id) && seen.add(j.id));
}

async function usajobsSearch(keyword, city, key, email) {
  const qs = new URLSearchParams({ Keyword: keyword, LocationName: city || "", ResultsPerPage: String(LIMIT) });
  try {
    const data = await getJson(`https://data.usajobs.gov/api/search?${qs}`, {
      headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key }, signal: timeout(),
    });
    const items = data.SearchResult?.SearchResultItems ?? [];
    note("usajobs", items.length);
    return items.map(({ MatchedObjectDescriptor: d }) => {
      const pay = d.PositionRemuneration?.[0] ?? {};
      const yearly = pay.RateIntervalCode === "PA";
      return {
        id: `usajobs-${d.PositionID}`, title: d.PositionTitle, company: d.OrganizationName,
        city: d.PositionLocationDisplay, lat: d.PositionLocation?.[0]?.Latitude ?? null, lng: d.PositionLocation?.[0]?.Longitude ?? null, work_mode: d.UserArea?.Details?.TeleworkEligible ? "hybrid" : "onsite",
        pay_min: yearly ? Number(pay.MinimumRange) : null, pay_max: yearly ? Number(pay.MaximumRange) : null,
        clearance: d.UserArea?.Details?.SecurityClearance || null,
        summary: (d.QualificationSummary || "").slice(0, 300), description: requirementsText(d.QualificationSummary), url: d.PositionURI, source: "USAJobs",
      };
    });
  } catch (err) {
    note("usajobs", 0, err.message);
    return [];
  }
}

// Adzuna (aggregates many job boards and company sites). Free key: https://developer.adzuna.com/
export async function adzuna(p, roles) {
  const { ADZUNA_APP_ID: id, ADZUNA_APP_KEY: key } = process.env;
  if (!id || !key) return [];
  // Search every target role and the most recent job title, plus entry-level searches for first-job seekers.
  const keywords = (roles || [...searchRoles(p), ...(isEntryLevel(p) ? ENTRY_SEARCHES : [])]).slice(0, 5);
  const where = await searchPlace(p.city);
  const search = async (what) => {
    const qs = new URLSearchParams({
      app_id: id, app_key: key, what, where, results_per_page: String(LIMIT),
      distance: String(Math.max(10, Math.round((p.commute_minutes || 30) * 1.3))), // rough km reachable in the commute
    });
    try {
      const results = (await getJson(`https://api.adzuna.com/v1/api/jobs/us/search/1?${qs}`)).results ?? [];
      note("adzuna", results.length);
      return results;
    } catch (err) {
      note("adzuna", 0, err.message);
      return [];
    }
  };
  const results = (await Promise.all(keywords.map(search))).flat();
  return results.map((j) => ({
    id: `adzuna-${j.id}`, title: j.title, company: j.company?.display_name, city: j.location?.display_name,
    lat: j.latitude ?? null, lng: j.longitude ?? null, work_mode: "onsite",
    pay_min: j.salary_min ? Math.round(j.salary_min) : null, pay_max: j.salary_max ? Math.round(j.salary_max) : null,
    pay_estimated: String(j.salary_is_predicted) === "1", // Adzuna's own estimate, not posted by the employer
    summary: (j.description || "").slice(0, 300), description: requirementsText(j.description), url: j.redirect_url, source: "Adzuna",
  }));
}

// JSearch (Google for Jobs). Brings in listings posted on LinkedIn, Indeed, Glassdoor, ZipRecruiter,
// and company career sites, each with its apply link. Indeed and LinkedIn do not offer public job
// search APIs and do not allow scraping, so this is the supported way to include their listings.
// https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch

// ---- JSearch plan: monthly allowance and speed limit ----
// RapidAPI sends the plan's monthly allowance with every response (x-ratelimit-requests-limit / -remaining /
// -reset), so the app follows whichever plan is bought instead of a number written into the code.
// Shown on /api/health. Paid plans charge for each request past the allowance, so JSearch pauses when only
// 5% is left (the other sources keep working) and picks up again when the allowance resets.
export const jsearchQuota = { limit: null, remaining: null, resets_at: null, checked_at: null };
function readQuota(res) {
  const h = res.headers;
  if (!h.has("x-ratelimit-requests-limit") || !h.has("x-ratelimit-requests-remaining")) return;
  const reset = Number(h.get("x-ratelimit-requests-reset")); // seconds until the allowance resets
  Object.assign(jsearchQuota, {
    limit: Number(h.get("x-ratelimit-requests-limit")), remaining: Number(h.get("x-ratelimit-requests-remaining")),
    resets_at: Number.isFinite(reset) && reset > 0 ? new Date(Date.now() + reset * 1000).toISOString() : null,
    checked_at: new Date().toISOString(),
  });
}
// Searches per match. Larger plans (Pro and up) search every target role plus more featured employers;
// until the first response shows the plan, or once three quarters of the month's allowance is used, the
// app searches like the free plan did.
const JSEARCH_SIZES = { small: { roles: 3, employers: 2 }, large: { roles: 5, employers: 4 } };
function jsearchSize() {
  const { limit, remaining, resets_at } = jsearchQuota;
  if (limit == null) return JSEARCH_SIZES.small;
  if (resets_at && Date.now() > Date.parse(resets_at)) return JSEARCH_SIZES.small; // new month: refreshed on the next reply
  if (remaining <= Math.max(25, limit * 0.05)) return null; // nearly used up: pause until it resets
  return limit >= 2000 && remaining > limit * 0.25 ? JSEARCH_SIZES.large : JSEARCH_SIZES.small;
}
const jsearchPaused = () => `JSearch paused to avoid overage charges: ${jsearchQuota.remaining} of ${jsearchQuota.limit} requests left this month.`;
// The plan allows 5 requests a second; requests start at least 210 ms apart (under 5 a second) even when
// several applicants search at once. Cached answers skip the wait.
let nextJsearchSlot = 0;
function jsearchTurn() {
  const now = Date.now();
  const at = Math.max(now, nextJsearchSlot);
  nextJsearchSlot = at + 210;
  return at > now ? new Promise((r) => setTimeout(r, at - now)) : undefined;
}
// One JSearch search. JSearch is slower than the others (it searches Google live), so it gets more time.
// In November 2026 JSearch moved search to /search-v2 (jobs under data.jobs); the old /search is kept as a fallback.
async function jsearchGet(qs, ttl = SEARCH_TTL) {
  const options = { ttl, before: jsearchTurn, onResponse: readQuota,
    headers: { "x-rapidapi-key": process.env.JSEARCH_API_KEY, "x-rapidapi-host": "jsearch.p.rapidapi.com" } };
  try { return await getJson(`https://jsearch.p.rapidapi.com/search-v2?${qs}`, options, 20000); }
  catch (err) {
    if (!/HTTP 404/.test(err.message)) throw err;
    return getJson(`https://jsearch.p.rapidapi.com/search?${qs}&page=1`, options, 20000);
  }
}

// The searches for one round. Round 0: the applicant's roles, plus their first role at each kind of workplace they
// want (hospitals, IT companies...). When too few jobs give them good chances, the Job Matcher widens the search:
// round 1 tries other common titles for the same work (from O*NET) and their next role at each workplace;
// rounds 2-4 look at the next pages of results for their main roles. Each search is cached for an hour.
export const MAX_WIDEN = 4;
function jsearchQueries(p, widen, size) {
  const roles = searchRoles(p);
  const places = workplaces(p);
  const at = (role) => places.map((w) => ({ q: `${role} ${w}`, workplace: w }));
  if (widen === 0) {
    const main = (isEntryLevel(p) ? [...roles.slice(0, size.roles - 1), ...ENTRY_SEARCHES] : roles).slice(0, size.roles);
    return [...main.map((q) => ({ q })), ...(roles[0] ? at(roles[0]).slice(0, size.employers) : [])];
  }
  if (widen === 1) return [...relatedTitles(roles.slice(0, 2), 3).map((q) => ({ q })), ...(roles[1] ? at(roles[1]).slice(0, 2) : [])];
  if (widen <= MAX_WIDEN) return roles.slice(0, 2).map((q) => ({ q, page: widen }));
  return [];
}

export async function jsearch(p, { widen = 0 } = {}) {
  const key = process.env.JSEARCH_API_KEY;
  if (!key) return [];
  const size = jsearchSize();
  if (!size) { note("jsearch", 0, jsearchPaused()); return []; }
  // A wider net brings in more Indeed, LinkedIn, and Monster listings.
  const queries = jsearchQueries(p, widen, size);
  if (!queries.length) return [];
  const where = await searchPlace(p.city);
  const one = async ({ q, workplace, page }) => {
    const qs = new URLSearchParams({
      query: where ? `${q} in ${where}` : q, num_pages: "1", country: "us", date_posted: "month",
      radius: String(Math.max(10, Math.round((p.commute_minutes || 30) * 1.3))), // rough km reachable in the commute
      ...(page > 1 ? { page: String(page) } : {}),
    });
    try {
      const res = await jsearchGet(qs);
      const data = Array.isArray(res.data) ? res.data : res.data?.jobs || [];
      note("jsearch", data.length, res.status && res.status !== "OK" ? String(res.error?.message || res.message || res.status) : null);
      return data.slice(0, 10).map((j) => ({ ...fromJSearch(j), ...(workplace ? { workplace } : {}) }));
    } catch (err) {
      note("jsearch", 0, err.message);
      return [];
    }
  };
  return (await Promise.all(queries.map(one))).flat();
}

// One Google for Jobs listing in the app's job shape.
function fromJSearch(j) {
  const yearly = j.job_salary_period === "YEAR", hourly = j.job_salary_period === "HOUR";
  const toYear = (n) => (n ? Math.round(hourly ? n * 2080 : n) : null);
  return {
    id: `jsearch-${j.job_id}`, title: j.job_title, company: j.employer_name,
    city: [j.job_city, j.job_state].filter(Boolean).join(", ") || (j.job_is_remote ? "Remote" : null),
    lat: j.job_latitude ?? null, lng: j.job_longitude ?? null, work_mode: j.job_is_remote ? "remote" : "onsite",
    pay_min: yearly || hourly ? toYear(j.job_min_salary) : null, pay_max: yearly || hourly ? toYear(j.job_max_salary) : null,
    summary: (j.job_description || "").slice(0, 300), description: requirementsText(j.job_description), url: j.job_apply_link,
    source: j.job_publisher ? `${j.job_publisher} via Google Jobs` : "Google Jobs",
    employer_website: /^https?:\/\//.test(j.employer_website || "") ? j.employer_website : null,
  };
}

// ---- Featured employers (data/employers.json), searched directly through Google for Jobs ----
// Employers like CACI post to Google for Jobs from their own careers sites, so their openings come with apply
// links to the employer. (Their Workday job pages disallow automated reading, so we don't read those directly.)
// Each search picks the employers that hire in the applicant's metro and best fit their target roles (2 on a
// small JSearch plan, 4 on Pro and up; see jsearchSize), and reuses each employer's results for a day.
const EMPLOYERS = JSON.parse(readFileSync(new URL("./data/employers.json", import.meta.url))).employers;
const EMPLOYER_TTL = 24 * 3600e3;
const fold = (t) => String(t || "").toLowerCase();

export async function pickEmployers(p, max = JSEARCH_SIZES.small.employers) {
  const metro = metroFor(await geocode(p.city))?.name;
  const words = fold([...(p.target_roles || []), ...(p.experience || []).map((e) => e.title), ...(p.skills || [])].join(" "));
  return EMPLOYERS
    .filter((e) => !e.feed) // employers with their own feed are read from it (feedEmployerJobs), not searched
    .filter((e) => e.metros.includes("any") || (metro && e.metros.includes(metro)))
    .map((e) => ({ e, fit: e.keywords.filter((k) => new RegExp(`\\b${k}`, "i").test(words)).length }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, max)
    .map((x) => x.e);
}

export async function employerJobs(p) {
  const key = process.env.JSEARCH_API_KEY;
  if (!key) return [];
  const size = jsearchSize();
  if (!size) { note("employers", 0, jsearchPaused()); return []; }
  const [employers, where] = await Promise.all([pickEmployers(p, size.employers), searchPlace(p.city)]);
  const role = searchRoles(p)[0] || "";
  const one = async (emp) => {
    const qs = new URLSearchParams({ query: `${role} ${emp.query} jobs${where ? ` in ${where}` : ""}`.trim(), num_pages: "1", country: "us", date_posted: "month" });
    try {
      const res = await jsearchGet(qs, EMPLOYER_TTL);
      const data = Array.isArray(res.data) ? res.data : res.data?.jobs || [];
      // Keep only that employer's own listings (searches can return other companies too).
      const name = fold(emp.name).split(" ")[0];
      // Apply on the employer's own careers site when Google lists it, rather than a job-board copy.
      const own = (j) => (j.apply_options || []).find((o) => fold(o.publisher).includes(name) || /careers|myworkdayjobs|icims|taleo/i.test(o.apply_link || ""));
      return data.filter((j) => fold(j.employer_name).includes(name))
        .sort((a, b) => Number(!!own(b)) - Number(!!own(a))) // postings on the employer's own site first
        .slice(0, 6)
        .map((j) => ({ ...fromJSearch(j), url: own(j)?.apply_link || j.job_apply_link, employer: emp.name, workplace: emp.group,
          source: own(j) ? `${emp.name} careers` : `${emp.name} via ${j.job_publisher || "Google Jobs"}` }));
    } catch (err) {
      note("employers", 0, err.message);
      return [];
    }
  };
  const jobs = (await Promise.all(employers.map(one))).flat();
  note("employers", jobs.length, null);
  return jobs;
}

// Employers with a public job feed (see feeds.js): every opening near the applicant whose title fits the roles
// they're after. No JSearch cost, so every feed employer in their metro is read on each search.
export async function feedEmployerJobs(p) {
  const metro = metroFor(await geocode(p.city))?.name;
  const employers = EMPLOYERS.filter((e) => e.feed && (e.metros.includes("any") || (metro && e.metros.includes(metro))));
  if (!employers.length) return [];
  const roles = [...searchRoles(p), ...relatedTitles(searchRoles(p).slice(0, 2), 3)];
  const { jobs, status } = await feedJobs(employers, { metro, wantsRemote: wantsRemote(p), roles });
  const failed = status.filter((s) => s.error);
  note("feeds", jobs.length, failed.length ? failed.map((s) => `${s.employer}: ${s.error}`).join("; ") : null);
  return jobs;
}

// The part of a job description the Scorecard needs to compare skills: the requirements, not the company intro.
// Starts at the first "Qualifications" / "Requirements" / "What you'll need" style heading when there is one,
// and keeps up to 2,500 characters (enough for the full requirements list in nearly every posting).
const REQ_HEADING = /(minimum |preferred |basic |required )?(qualifications|requirements|what you('|’)ll (need|bring)|what we('|’)re looking for|skills and experience|who you are|you have|must have)/i;
export function requirementsText(text, max = 2500) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const at = t.search(REQ_HEADING);
  const start = at > 0 ? Math.max(0, at - 150) : 0;
  return t.slice(start, start + max);
}

// Remotive (remote jobs). No key needed.
export async function remotive(p) {
  if (!wantsRemote(p)) return [];
  try {
    const { jobs = [] } = await getJson(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(firstRole(p))}&limit=5`);
    return jobs.slice(0, 5).map((j) => ({
      id: `remotive-${j.id}`, title: j.title, company: j.company_name, city: "Remote", work_mode: "remote",
      ...yearlyPay(j.salary), pay_text: j.salary || null, skills: (j.tags || []).slice(0, 6), url: j.url, source: "Remotive",
    }));
  } catch {
    return [];
  }
}

// Local = jobs you commute to (USAJobs, Adzuna, Google Jobs). Remote = Remotive.
// The same opening often appears on several boards, so repeats (same title and company) are dropped.
// `widen` is the search round (see jsearchQueries): round 0 searches every source; round 1 searches other common
// titles for the same work on the job boards too; later rounds only page further into Google for Jobs.
export async function liveJobs(p, { widen = 0 } = {}) {
  const related = widen === 1 ? relatedTitles(searchRoles(p).slice(0, 2), 3) : null;
  const none = async () => [];
  const [fed, board, google, remote, featured, feeds] = await Promise.all([
    widen === 0 ? usajobs(p) : related ? usajobs(p, related) : none(),
    widen === 0 ? adzuna(p) : related ? adzuna(p, related) : none(),
    jsearch(p, { widen }),
    widen === 0 ? remotive(p) : none(),
    widen === 0 ? employerJobs(p) : none(),
    widen === 0 ? feedEmployerJobs(p) : none(),
  ]);
  // Take turns between sources so no single one fills the list, then drop repeats (same title and company).
  const lists = [[...feeds, ...featured], google, board, isEntryLevel(p) ? [] : fed]; // federal listings rarely suit a first job
  const mixed = [];
  for (let i = 0; i < Math.max(...lists.map((l) => l.length)); i++) for (const l of lists) if (l[i]) mixed.push(l[i]);
  const seen = new Set();
  const local = mixed.filter((j) => {
    const k = `${j.title}|${j.company}`.toLowerCase().replace(/\s+/g, " ");
    return !seen.has(k) && seen.add(k);
  }).map(markHiringNow);
  return { local, remote: remote.map(markHiringNow) };
}

// Starts the live job search in the background while the applicant is still answering profile
// questions. JSearch alone takes 10-30 seconds, so by the time they open their matches the results
// are usually already cached. Same searches as matchJobs, so no extra cost unless the role, city,
// or commute changes between answers. Never throws: each source already handles its own errors.
export function prefetchJobs(p) {
  if (p?.city && searchRoles(p).length) liveJobs(p).catch(() => {});
}

// "$14/hour" -> 29120 a year; "70K-80K" -> 70000-80000. Unparseable text stays as text only.
function yearlyPay(text = "") {
  const nums = [...String(text).matchAll(/\$?\s*(\d+(?:[.,]\d+)?)\s*(k)?/gi)].map((m) => parseFloat(m[1].replace(",", "")) * (m[2] ? 1000 : 1));
  if (!nums.length) return {};
  const hourly = /hour|hr/i.test(text) || nums[0] < 200;
  const [lo, hi = lo] = nums.map((n) => Math.round(hourly ? n * 2080 : n));
  return { pay_min: lo, pay_max: hi };
}
