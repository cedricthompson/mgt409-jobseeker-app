// Agent 3: Job Matcher.
// Only jobs where the applicant has at least a 50% chance of an interview AND at least a 50% chance of an offer
// are shown. Each round:
//   1. (code, no tokens) gather jobs near the applicant from the live sources in sources.js (USAJobs, Adzuna,
//      Google Jobs, Remotive, featured employers, and nearby hospitals / IT companies), or the sample dataset;
//   2. (one model call) shortlist the new jobs the applicant has the best real chance at, their own job ideas first;
//   3. (Scorecard agent) score the shortlist and keep the jobs that clear both 50% bars.
// When fewer than TARGET jobs qualify, the search widens (other common titles for the same work, then more pages
// of results) for up to ROUNDS_PER_REQUEST rounds. If still none qualify, the app offers "Keep looking", which
// continues from the next round and skips every job already checked.
import { readFileSync } from "node:fs";
import { chat } from "../llm.js";
import { isEntryLevel, liveJobs, markHiringNow, MAX_WIDEN, searchRoles } from "../sources.js";
import { geocode, metroFor } from "../geo.js";
import { SAFETY, accessibility } from "./common.js";
import { jobFacts } from "./fairness.js";
import { scorecard } from "./scorecard.js";

const SAMPLE = JSON.parse(readFileSync(new URL("../data/sample-jobs.json", import.meta.url)));

export const MIN_INTERVIEW = 50; // percent chance of an interview
export const MIN_HIRE = 50; // percent chance of an offer once interviewed
const TARGET = 6; // stop widening once this many jobs qualify (the app asks for 3 first, to show results sooner)
const ROUNDS_PER_REQUEST = 3; // keeps one request to about a minute
const SHORTLIST = 20; // jobs scored per round
// Speed: the Scorecard scores one job per call, up to 12 calls at once. Measured on 7 real jobs: 31 s in one call,
// 8 s one per call in parallel (each call writes a short answer, and they all run at the same time).
const SCORE_PARALLEL = 12;
// Speed (Nov 2026: Pro JSearch plus employer feeds brought ~70 jobs a round, and a search took 2.5 minutes):
const SHORTLIST_MAX = 35; // jobs the model reads per round, best title fits first
const TIME_BUDGET = 60e3; // a request returns after about a minute; the app shows what's found and asks for the next round itself

// Jobs whose titles share the most words with the roles being searched go first, so the shortlist reads the
// likeliest fits. Ties keep the sources' turn-taking order.
const titleWords = (t) => String(t || "").toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length > 2);
function byTitleFit(profile, jobs) {
  const want = new Set(searchRoles(profile).flatMap(titleWords));
  return jobs.map((j, i) => ({ j, i, fit: titleWords(j.title).filter((w) => want.has(w)).length }))
    .sort((a, b) => b.fit - a.fit || a.i - b.i).map((x) => x.j);
}

// Runs fn over items with at most `limit` running at once, keeping the order.
async function inParallel(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

export const qualifies = (c) => c?.predictions?.interview >= MIN_INTERVIEW && c?.predictions?.hire >= MIN_HIRE;
// Both chances matter, so jobs are ranked by the chance of getting an interview and then the offer.
const bothChances = (c) => (c.predictions.interview / 100) * (c.predictions.hire / 100);

const wantsRemote = (p) => /remote|any|hybrid|open/i.test(p.work_mode || "");

// Sample jobs near the applicant: same metro area by distance (so Washington, DC does not pull in
// Baltimore just because both touch Maryland). Falls back to all samples when the metro isn't covered.
async function localJobs(p) {
  const home = metroFor(await geocode(p.city));
  const near = home ? SAMPLE.filter((j) => j.lat != null && metroFor({ lat: j.lat, lng: j.lng }) === home) : [];
  const remote = wantsRemote(p) ? SAMPLE.filter((j) => j.work_mode === "remote") : [];
  return near.length ? [...near, ...remote] : SAMPLE;
}

const SYSTEM = `You are the Job Matcher agent of a job search app. Shortlist the jobs where this applicant has the best
real chance of BOTH getting an interview and getting the offer. Only jobs where both chances are at least 50% will be shown.
- The applicant's own job ideas come first: "job_interests.titles" are the jobs they told us they want, and
  "job_interests.workplaces" the kinds of workplace (for example hospitals or IT companies). Rank jobs that match those
  titles, or close variations of them, highest. Other jobs are fine when they suit the applicant's experience and
  direction, unless job_interests.open_to_related is false; then include only close variations of their titles.
- Favor jobs whose stated requirements the applicant already meets: years of experience, degree, certifications or
  licenses, and clearance. Skip jobs that need experience, licenses, or degrees they don't have; those rarely lead to an offer.
- Consider transferable experience (e.g. shift lead -> supervisor roles), pay target, and work mode. Never use protected traits.
- If the applicant is starting out (little or no work history), favor entry-level jobs that need no experience
  (fast food, retail, customer service, warehouse, and similar), especially ones marked hiring_now.
${SAFETY}
Reply ONLY with JSON: {"ids": [string]}, the job ids, best chance first. Nothing else: the Scorecard explains each job.
Return up to ${SHORTLIST} jobs. The Scorecard checks each job's odds next, so include every job the
applicant could plausibly get; leave out only jobs that clearly don't fit (a required license, degree, or clearance they
lack, far more years of experience than they have, or work unrelated to their background and goals). Never list the same job twice.`;

const compact = (j) => ({ id: j.id, title: j.title, company: j.company, city: j.city, mode: j.work_mode,
  pay: j.pay_min ? `${j.pay_min}-${j.pay_max}` : j.pay_text, exp_years: j.experience_years,
  certs: j.required_certs, clearance: j.clearance, skills: j.skills, source: j.source || "sample", hiring_now: j.hiring_now || undefined,
  workplace: j.workplace, summary: j.source ? j.summary : undefined });

export async function shortlist(profile, jobs, { session, prefs }) {
  const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));
  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "user", content: `Applicant: ${JSON.stringify({ ...jobFacts(profile), starting_out: isEntryLevel(profile) || undefined })}\nJobs: ${JSON.stringify(jobs.map(compact))}` },
    ],
    { json: true, agent: "matcher", session, effort: "none" } // a quick pick; the Scorecard checks every job it keeps
  );
  // One entry per job, even if the model repeats one. Speed: the model returns only ids (writing a reason for
  // 20 jobs took about 30 s); each job's reason and gaps come from its scorecard instead.
  const out = JSON.parse(text);
  const ids = (Array.isArray(out.ids) ? out.ids : (out.matches || []).map((m) => m?.id)).map(String);
  return [...new Set(ids)].filter((id) => byId[id]).slice(0, SHORTLIST).map((id) => ({ id, job: byId[id] }));
}

// Nearby employers of the kinds the applicant wants (hospitals, IT companies...) that are hiring for similar work,
// so they can reach out directly. Employers where the applicant already has a qualifying job come first.
function reachOut(jobs, found) {
  const good = new Set(found.map((m) => String(m.job.company || "").toLowerCase()));
  const by = new Map();
  for (const j of jobs) {
    if (!j.workplace || !j.company) continue;
    const k = j.company.toLowerCase();
    const e = by.get(k) || { name: j.company, kind: j.workplace, city: j.city || null, website: null, openings: 0, example: j.title };
    e.openings += 1;
    e.website ||= j.employer_website || null;
    by.set(k, e);
  }
  return [...by.values()]
    .sort((a, b) => Number(good.has(b.name.toLowerCase())) - Number(good.has(a.name.toLowerCase())) || b.openings - a.openings)
    .slice(0, 8);
}

const jobKey = (j) => `${j.title}|${j.company}`.toLowerCase().replace(/\s+/g, " ");

export async function matchJobs({ profile = {}, session, prefs, round = 0, exclude = [], target = TARGET }) {
  const enough = Math.max(1, Math.min(Number(target) || TARGET, TARGET));
  const seen = new Set((Array.isArray(exclude) ? exclude : []).map(String));
  const found = [], gathered = [], timing = []; // seconds per step of each round, to keep an eye on speed
  const clock = () => { const t = Date.now(); return () => Math.round((Date.now() - t) / 100) / 10; };
  let considered = 0, scored = 0, data = "live";
  const first = Math.max(0, Math.min(Number(round) || 0, MAX_WIDEN + 1));
  let r = first;
  // Speed: the next round's search starts while this round is being scored, so widening doesn't wait on the job sites.
  // (Searches are cached for an hour, so one that ends up unused costs nothing if the applicant keeps looking.)
  let upcoming = liveJobs(profile, { widen: r });
  const started = Date.now();
  for (; r <= MAX_WIDEN && r < first + ROUNDS_PER_REQUEST && found.length < enough
    && Date.now() - started < TIME_BUDGET; r++) {
    const searchTime = clock();
    const live = await upcoming;
    const step = { round: r, search: searchTime() };
    upcoming = r + 1 <= MAX_WIDEN && r + 1 < first + ROUNDS_PER_REQUEST ? liveJobs(profile, { widen: r + 1 }) : null;
    upcoming?.catch(() => {});
    // Real local listings come first. Sample jobs are fictional, so they're only used when
    // no live local source returns anything (no keys set, offline, or no results), and are never widened.
    let pool = [...live.local, ...live.remote];
    if (r === 0 && !live.local.length) { data = "sample"; pool = [...(await localJobs(profile)).map(markHiringNow), ...live.remote]; }
    const fresh = pool.filter((j) => !seen.has(j.id) && !seen.has(jobKey(j)));
    for (const j of fresh) { seen.add(j.id); seen.add(jobKey(j)); }
    gathered.push(...fresh);
    considered += fresh.length;
    if (fresh.length) {
      const t1 = clock();
      const pick = () => shortlist(profile, byTitleFit(profile, fresh).slice(0, SHORTLIST_MAX), { session, prefs });
      const picks = await pick().catch(() => pick()); // one retry if the model call fails
      step.shortlist = t1();
      const t2 = clock();
      // A failed model call (the provider sometimes returns a 500) is retried once; if it fails again, that one job
      // is skipped instead of failing the whole search.
      const scoreOne = (m) => scorecard({ profile, jobs: [m.job], session, prefs });
      const cards = (await inParallel(picks, SCORE_PARALLEL, (m) => scoreOne(m).catch(() => scoreOne(m)).catch((err) => {
        console.error(`Scorecard failed for ${m.job.id}:`, err.message);
        return [];
      }))).flat();
      step.score = t2();
      scored += cards.length;
      const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
      for (const m of picks) {
        const card = byId[m.id];
        if (!qualifies(card)) continue;
        const gaps = (card.requirements || []).filter((x) => !x.have).map((x) => x.skill).slice(0, 3);
        found.push({ ...m, fit: card.overall >= 80 ? "strong" : "good", why: "", gaps, card }); // the card shows its explanation
      }
    }
    timing.push({ ...step, jobs: fresh.length });
    if (data === "sample") { r = MAX_WIDEN + 1; break; } // nothing more to search
  }
  found.sort((a, b) => bothChances(b.card) - bothChances(a.card));
  return {
    matches: found, data, considered, scored, timing,
    min: { interview: MIN_INTERVIEW, hire: MIN_HIRE },
    next_round: r <= MAX_WIDEN ? r : null, // where "Keep looking" continues; null when every search has been tried
    checked: [...seen], // jobs already checked, so "Keep looking" only scores new ones
    reach_out: reachOut(gathered, found),
  };
}
