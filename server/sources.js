// Live job sources. Each is optional: if its key is missing or the request fails,
// it returns [] and the app falls back to the sample dataset.
// Every source returns jobs in the same shape as data/sample-jobs.json.
import "./env.js";
import { readFileSync } from "node:fs";
import { geocode, metroFor } from "./geo.js";
import { totalYears } from "./experience.js";

const LIMIT = 8;

// Job searches are cached for an hour (job boards don't change minute to minute),
// which keeps us well under each source's free daily limit. Kept in memory only (URLs can contain keys), never written to disk.
const SEARCH_TTL = 3600e3;
const searchCache = new Map();
// Searches still running, so a match request that arrives during a background prefetch
// (see prefetchJobs) waits for that search instead of starting a second one.
const inFlight = new Map();
async function getJson(url, { ttl = SEARCH_TTL, ...options } = {}, ms = 6000) {
  const hit = searchCache.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.data;
  if (inFlight.has(url)) return inFlight.get(url);
  const request = (async () => {
    const res = await fetch(url, { ...options, signal: AbortSignal.timeout(ms) });
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
  return { usajobs: !!(e.USAJOBS_API_KEY && e.USAJOBS_EMAIL), adzuna: !!(e.ADZUNA_APP_ID && e.ADZUNA_APP_KEY), jsearch: !!e.JSEARCH_API_KEY, employers: !!e.JSEARCH_API_KEY, remotive: true };
}
const firstRole = (p) => (p.target_roles || [])[0] || (p.experience || [])[0]?.title || "";

// Every role worth searching: up to three target roles plus the most recent job title.
export const searchRoles = (p) => [...new Set([...(p.target_roles || []).slice(0, 3), (p.experience || [])[0]?.title]
  .filter(Boolean).map((r) => String(r).trim()))];

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
export async function usajobs(p) {
  const { USAJOBS_API_KEY: key, USAJOBS_EMAIL: email } = process.env;
  if (!key || !email) return [];
  const keywords = searchRoles(p).slice(0, 2);
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
export async function adzuna(p) {
  const { ADZUNA_APP_ID: id, ADZUNA_APP_KEY: key } = process.env;
  if (!id || !key) return [];
  // Search every target role and the most recent job title, plus entry-level searches for first-job seekers.
  const keywords = [...searchRoles(p), ...(isEntryLevel(p) ? ENTRY_SEARCHES : [])].slice(0, 5);
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
// Free key (about 200 searches a month): https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
// One search per match request, cached for an hour, to stay inside the free plan.
export async function jsearch(p) {
  const key = process.env.JSEARCH_API_KEY;
  // Up to three searches per match (each cached for an hour): the target roles, and for first-job seekers
  // one entry-level "hiring now" search. A wider net brings in more Indeed, LinkedIn, and Monster listings.
  const roles = searchRoles(p);
  const queries = (isEntryLevel(p) ? [...roles.slice(0, 2), ENTRY_SEARCHES[0]] : roles).slice(0, 3);
  if (!key || !queries.length) return [];
  const where = await searchPlace(p.city);
  const one = async (role) => {
    const qs = new URLSearchParams({
      query: where ? `${role} in ${where}` : role, num_pages: "1", country: "us", date_posted: "month",
      radius: String(Math.max(10, Math.round((p.commute_minutes || 30) * 1.3))), // rough km reachable in the commute
    });
    const headers = { "x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com" };
    try {
      // JSearch is slower than the others (it searches Google live), so it gets more time.
      // In November 2026 JSearch moved search to /search-v2 (jobs under data.jobs); the old /search is kept as a fallback.
      let res;
      try { res = await getJson(`https://jsearch.p.rapidapi.com/search-v2?${qs}`, { headers }, 20000); }
      catch (err) {
        if (!/HTTP 404/.test(err.message)) throw err;
        res = await getJson(`https://jsearch.p.rapidapi.com/search?${qs}&page=1`, { headers }, 20000);
      }
      const data = Array.isArray(res.data) ? res.data : res.data?.jobs || [];
      note("jsearch", data.length, res.status && res.status !== "OK" ? String(res.error?.message || res.message || res.status) : null);
      return data.slice(0, 10).map(fromJSearch);
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
  };
}

// ---- Featured employers (data/employers.json), searched directly through Google for Jobs ----
// Employers like CACI post to Google for Jobs from their own careers sites, so their openings come with apply
// links to the employer. (Their Workday job pages disallow automated reading, so we don't read those directly.)
// To stay inside the free JSearch plan, each search picks at most 2 employers that hire in the applicant's metro
// and best fit their target roles, and reuses each employer's results for a day.
const EMPLOYERS = JSON.parse(readFileSync(new URL("./data/employers.json", import.meta.url))).employers;
const EMPLOYER_TTL = 24 * 3600e3;
const MAX_EMPLOYERS = 2;
const fold = (t) => String(t || "").toLowerCase();

export async function pickEmployers(p) {
  const metro = metroFor(await geocode(p.city))?.name;
  const words = fold([...(p.target_roles || []), ...(p.experience || []).map((e) => e.title), ...(p.skills || [])].join(" "));
  return EMPLOYERS
    .filter((e) => e.metros.includes("any") || (metro && e.metros.includes(metro)))
    .map((e) => ({ e, fit: e.keywords.filter((k) => new RegExp(`\\b${k}`, "i").test(words)).length }))
    .filter((x) => x.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .slice(0, MAX_EMPLOYERS)
    .map((x) => x.e);
}

export async function employerJobs(p) {
  const key = process.env.JSEARCH_API_KEY;
  if (!key) return [];
  const [employers, where] = await Promise.all([pickEmployers(p), searchPlace(p.city)]);
  const role = searchRoles(p)[0] || "";
  const headers = { "x-rapidapi-key": key, "x-rapidapi-host": "jsearch.p.rapidapi.com" };
  const one = async (emp) => {
    const qs = new URLSearchParams({ query: `${role} ${emp.query} jobs${where ? ` in ${where}` : ""}`.trim(), num_pages: "1", country: "us", date_posted: "month" });
    try {
      const res = await getJson(`https://jsearch.p.rapidapi.com/search-v2?${qs}`, { headers, ttl: EMPLOYER_TTL }, 20000);
      const data = Array.isArray(res.data) ? res.data : res.data?.jobs || [];
      // Keep only that employer's own listings (searches can return other companies too).
      const name = fold(emp.name).split(" ")[0];
      // Apply on the employer's own careers site when Google lists it, rather than a job-board copy.
      const own = (j) => (j.apply_options || []).find((o) => fold(o.publisher).includes(name) || /careers|myworkdayjobs|icims|taleo/i.test(o.apply_link || ""));
      return data.filter((j) => fold(j.employer_name).includes(name))
        .sort((a, b) => Number(!!own(b)) - Number(!!own(a))) // postings on the employer's own site first
        .slice(0, 6)
        .map((j) => ({ ...fromJSearch(j), url: own(j)?.apply_link || j.job_apply_link, employer: emp.name,
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
export async function liveJobs(p) {
  const [fed, board, google, remote, featured] = await Promise.all([usajobs(p), adzuna(p), jsearch(p), remotive(p), employerJobs(p)]);
  // Take turns between sources so no single one fills the list, then drop repeats (same title and company).
  const lists = [featured, google, board, isEntryLevel(p) ? [] : fed]; // federal listings rarely suit a first job
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
