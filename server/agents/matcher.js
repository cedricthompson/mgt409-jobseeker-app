// Agent 3: Job Matcher.
// Step 1 (code, no tokens): gather jobs near the applicant from the sample dataset,
//   plus live remote jobs from Remotive when the applicant is open to remote work.
// Step 2 (one model call): rank the shortlist and explain each match.
import { readFileSync } from "node:fs";
import { chat } from "../llm.js";
import { SAFETY, accessibility } from "./common.js";

const SAMPLE = JSON.parse(readFileSync(new URL("../data/sample-jobs.json", import.meta.url)));

const state = (s = "") => (s.match(/,\s*([A-Z]{2})\b/) || [])[1];
const wantsRemote = (p) => /remote|any|hybrid|open/i.test(p.work_mode || "");

function localJobs(p) {
  const city = (p.city || "").toLowerCase().split(",")[0].trim();
  const st = state(p.city || "");
  const near = SAMPLE.filter((j) => j.city !== "Remote" &&
    ((city && j.city.toLowerCase().startsWith(city)) || (st && state(j.city) === st)));
  const remote = wantsRemote(p) ? SAMPLE.filter((j) => j.work_mode === "remote") : [];
  // If the applicant's city isn't in the sample data, show everything and let the agent rank it.
  return near.length ? [...near, ...remote] : SAMPLE;
}

async function remotiveJobs(p) {
  if (!wantsRemote(p)) return [];
  const q = encodeURIComponent((p.target_roles || [])[0] || "");
  try {
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${q}&limit=5`, { signal: AbortSignal.timeout(5000) });
    const { jobs = [] } = await res.json();
    return jobs.map((j) => ({
      id: `remotive-${j.id}`, title: j.title, company: j.company_name, city: "Remote", work_mode: "remote",
      pay_text: j.salary || null, skills: (j.tags || []).slice(0, 6), category: j.category, url: j.url, source: "Remotive",
    }));
  } catch {
    return []; // Live source is optional; the sample data still works offline.
  }
}

const SYSTEM = `You are the Job Matcher agent of a job search app. Rank the jobs that best fit the applicant.
Consider target roles, transferable experience (e.g. shift lead -> supervisor roles), certifications, clearance, pay target, and work mode.
Include realistic stretch roles that fit the applicant's direction. Never use protected traits.
${SAFETY}
Reply ONLY with JSON: {"matches": [{"id": string, "fit": "strong" | "good" | "stretch", "why": string, "gaps": [string]}]}
Return up to 8 matches, best first. "why" is one sentence. "gaps" lists missing requirements (empty if none).`;

const compact = (j) => ({ id: j.id, title: j.title, company: j.company, city: j.city, mode: j.work_mode,
  pay: j.pay_min ? `${j.pay_min}-${j.pay_max}` : j.pay_text, exp_years: j.experience_years,
  certs: j.required_certs, clearance: j.clearance, skills: j.skills });

export async function matchJobs({ profile = {}, session, prefs }) {
  const jobs = [...localJobs(profile), ...(await remotiveJobs(profile))];
  const byId = Object.fromEntries(jobs.map((j) => [j.id, j]));

  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "user", content: `Applicant: ${JSON.stringify(profile)}\nJobs: ${JSON.stringify(jobs.map(compact))}` },
    ],
    { json: true, agent: "matcher", session }
  );
  const { matches = [] } = JSON.parse(text);
  return { considered: jobs.length, matches: matches.filter((m) => byId[m.id]).map((m) => ({ ...m, job: byId[m.id] })) };
}
