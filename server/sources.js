// Live job sources. Each is optional: if its key is missing or the request fails,
// it returns [] and the app falls back to the sample dataset.
// Every source returns jobs in the same shape as data/sample-jobs.json.
import "./env.js";
import { geocode, metroFor } from "./geo.js";

const LIMIT = 8;
const timeout = () => AbortSignal.timeout(6000);
const firstRole = (p) => (p.target_roles || [])[0] || (p.experience || [])[0]?.title || "";
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
  const keywords = [...new Set([(p.target_roles || [])[0], (p.experience || [])[0]?.title].filter(Boolean))];
  const where = await searchPlace(p.city);
  const results = await Promise.all(keywords.map((k) => usajobsSearch(k, where, key, email)));
  const seen = new Set();
  return results.flat().filter((j) => !seen.has(j.id) && seen.add(j.id));
}

async function usajobsSearch(keyword, city, key, email) {
  const qs = new URLSearchParams({ Keyword: keyword, LocationName: city || "", ResultsPerPage: String(LIMIT) });
  try {
    const res = await fetch(`https://data.usajobs.gov/api/search?${qs}`, {
      headers: { Host: "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key }, signal: timeout(),
    });
    const items = (await res.json()).SearchResult?.SearchResultItems ?? [];
    return items.map(({ MatchedObjectDescriptor: d }) => {
      const pay = d.PositionRemuneration?.[0] ?? {};
      const yearly = pay.RateIntervalCode === "PA";
      return {
        id: `usajobs-${d.PositionID}`, title: d.PositionTitle, company: d.OrganizationName,
        city: d.PositionLocationDisplay, lat: d.PositionLocation?.[0]?.Latitude ?? null, lng: d.PositionLocation?.[0]?.Longitude ?? null, work_mode: d.UserArea?.Details?.TeleworkEligible ? "hybrid" : "onsite",
        pay_min: yearly ? Number(pay.MinimumRange) : null, pay_max: yearly ? Number(pay.MaximumRange) : null,
        clearance: d.UserArea?.Details?.SecurityClearance || null,
        summary: (d.QualificationSummary || "").slice(0, 300), url: d.PositionURI, source: "USAJobs",
      };
    });
  } catch {
    return [];
  }
}

// Adzuna (aggregates many job boards and company sites). Free key: https://developer.adzuna.com/
export async function adzuna(p) {
  const { ADZUNA_APP_ID: id, ADZUNA_APP_KEY: key } = process.env;
  if (!id || !key) return [];
  const qs = new URLSearchParams({
    app_id: id, app_key: key, what: firstRole(p), where: await searchPlace(p.city), results_per_page: String(LIMIT),
    distance: String(Math.max(10, Math.round((p.commute_minutes || 30) * 1.3))), // rough km reachable in the commute
  });
  try {
    const res = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?${qs}`, { signal: timeout() });
    const { results = [] } = await res.json();
    return results.map((j) => ({
      id: `adzuna-${j.id}`, title: j.title, company: j.company?.display_name, city: j.location?.display_name,
      lat: j.latitude ?? null, lng: j.longitude ?? null, work_mode: "onsite",
      pay_min: j.salary_min ? Math.round(j.salary_min) : null, pay_max: j.salary_max ? Math.round(j.salary_max) : null,
      summary: (j.description || "").slice(0, 300), url: j.redirect_url, source: "Adzuna",
    }));
  } catch {
    return [];
  }
}

// Remotive (remote jobs). No key needed.
export async function remotive(p) {
  if (!wantsRemote(p)) return [];
  try {
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(firstRole(p))}&limit=5`, { signal: timeout() });
    const { jobs = [] } = await res.json();
    return jobs.slice(0, 5).map((j) => ({
      id: `remotive-${j.id}`, title: j.title, company: j.company_name, city: "Remote", work_mode: "remote",
      ...yearlyPay(j.salary), pay_text: j.salary || null, skills: (j.tags || []).slice(0, 6), url: j.url, source: "Remotive",
    }));
  } catch {
    return [];
  }
}

// Local = jobs you commute to (USAJobs, Adzuna). Remote = Remotive.
export async function liveJobs(p) {
  const [fed, board, remote] = await Promise.all([usajobs(p), adzuna(p), remotive(p)]);
  return { local: [...fed, ...board], remote };
}

// "$14/hour" -> 29120 a year; "70K-80K" -> 70000-80000. Unparseable text stays as text only.
function yearlyPay(text = "") {
  const nums = [...String(text).matchAll(/\$?\s*(\d+(?:[.,]\d+)?)\s*(k)?/gi)].map((m) => parseFloat(m[1].replace(",", "")) * (m[2] ? 1000 : 1));
  if (!nums.length) return {};
  const hourly = /hour|hr/i.test(text) || nums[0] < 200;
  const [lo, hi = lo] = nums.map((n) => Math.round(hourly ? n * 2080 : n));
  return { pay_min: lo, pay_max: hi };
}
