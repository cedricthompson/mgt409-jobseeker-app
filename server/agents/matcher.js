// Agent 3: Job Matcher.
// Step 1 (code, no tokens): gather jobs near the applicant from the sample dataset
//   and the live sources (USAJobs, Adzuna, Google Jobs, Remotive) in sources.js.
// Step 2 (one model call): rank the shortlist and explain each match.
import { readFileSync } from "node:fs";
import { chat } from "../llm.js";
import { isEntryLevel, liveJobs, markHiringNow } from "../sources.js";
import { geocode, metroFor } from "../geo.js";
import { SAFETY, accessibility } from "./common.js";
import { jobFacts } from "./fairness.js";

const SAMPLE = JSON.parse(readFileSync(new URL("../data/sample-jobs.json", import.meta.url)));

const wantsRemote = (p) => /remote|any|hybrid|open/i.test(p.work_mode || "");

// Sample jobs near the applicant: same metro area by distance (so Washington, DC does not pull in
// Baltimore just because both touch Maryland). Falls back to all samples when the metro isn't covered.
async function localJobs(p) {
  const home = metroFor(await geocode(p.city));
  const near = home ? SAMPLE.filter((j) => j.lat != null && metroFor({ lat: j.lat, lng: j.lng }) === home) : [];
  const remote = wantsRemote(p) ? SAMPLE.filter((j) => j.work_mode === "remote") : [];
  return near.length ? [...near, ...remote] : SAMPLE;
}

const SYSTEM = `You are the Job Matcher agent of a job search app. Rank the jobs that best fit the applicant.
Consider target roles, transferable experience (e.g. shift lead -> supervisor roles), certifications, clearance, pay target, and work mode.
Include realistic stretch roles that fit the applicant's direction. Never use protected traits.
If the applicant is starting out (little or no work history), rank entry-level jobs that need no experience first
(fast food, retail, customer service, warehouse, and similar), especially ones marked hiring_now, and do not include
jobs that require years of experience or a degree they don't have.
${SAFETY}
Reply ONLY with JSON: {"matches": [{"id": string, "fit": "strong" | "good" | "stretch", "why": string, "gaps": [string]}]}
Return 6 to 10 matches, best first, whenever at least 6 jobs are reasonable or stretch fits; return fewer only when fewer fit.
Never list the same job twice. "why" is one sentence. "gaps" lists missing requirements (empty if none).`;

const compact = (j) => ({ id: j.id, title: j.title, company: j.company, city: j.city, mode: j.work_mode,
  pay: j.pay_min ? `${j.pay_min}-${j.pay_max}` : j.pay_text, exp_years: j.experience_years,
  certs: j.required_certs, clearance: j.clearance, skills: j.skills, source: j.source || "sample", hiring_now: j.hiring_now || undefined,
  summary: j.source ? j.summary : undefined });

export async function matchJobs({ profile = {}, session, prefs }) {
  // Real local listings come first. Sample jobs are fictional, so they're only used when
  // no live local source returns anything (no keys set, offline, or no results).
  const live = await liveJobs(profile);
  const local = live.local.length ? live.local : (await localJobs(profile)).map(markHiringNow);
  const jobs = [...local.slice(0, 40), ...live.remote]; // cap the list so the ranking call stays affordable
  const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));

  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "user", content: `Applicant: ${JSON.stringify({ ...jobFacts(profile), starting_out: isEntryLevel(profile) || undefined })}\nJobs: ${JSON.stringify(jobs.map(compact))}` },
    ],
    { json: true, agent: "matcher", session, effort: "low" }
  );
  // One entry per job, even if the model repeats one.
  const seen = new Set();
  const matches = (JSON.parse(text).matches || []).filter((m) => byId[m.id] && !seen.has(m.id) && seen.add(m.id));
  return { considered: jobs.length, data: live.local.length ? "live" : "sample", matches: matches.map((m) => ({ ...m, job: byId[m.id] })) };
}
