// Agent 4: Scorecard / Predictor.
// Part 1 (code, no tokens, fully explainable): commute, pay, credentials, and experience scores, 0-100.
// Part 2 (one model call for all jobs): skills score and outcome estimates
//   (interview, hire, promotion within a year, still employed at 12/18/24 months), each with a reason.
import { chat } from "../llm.js";
import { geocode, commute } from "../geo.js";
import { SAFETY, accessibility } from "./common.js";

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const CLEARANCE = ["none", "public trust", "secret", "top secret", "ts/sci"];
const clearanceRank = (s) => {
  const t = String(s || "none").toLowerCase();
  if (/sci|compartmented/.test(t)) return 4;
  if (/top secret/.test(t)) return 3;
  if (/secret/.test(t)) return 2;
  if (/public trust/.test(t)) return 1;
  return 0;
};

const MODE_WORDS = { drive: "driving", transit: "by public transit", bike: "by bike", walk: "walking" };
function commuteScore(job, { minutes, method }, max = 30, mode = "drive") {
  if (job.work_mode === "remote") return { score: 100, note: "Remote job: no commute." };
  if (minutes == null) return { score: null, note: "Commute unknown (job location not specific)." };
  const score = minutes <= max ? 100 : clamp(100 - ((minutes - max) / max) * 100);
  const how = `${method === "routed" ? "" : "About "}${minutes} min each way ${MODE_WORDS[mode] || "driving"}${method === "routed" ? " (real schedule)" : " (estimate)"}`;
  return { score, note: `${how}; your limit is ${max}.` };
}

function payScore(job, target) {
  if (!target || !job.pay_min) return { score: null, note: "Pay not listed or no target set." };
  const mid = (job.pay_min + (job.pay_max || job.pay_min)) / 2;
  return { score: clamp(100 - ((target - mid) / target) * 200), note: `Pays about $${Math.round(mid).toLocaleString()} vs your target of $${Number(target).toLocaleString()}.` };
}

function credentialScore(job, p) {
  const held = (p.certifications || []).map((c) => c.toLowerCase());
  const req = job.required_certs || [];
  const missing = req.filter((c) => !held.some((h) => h.includes(c.toLowerCase()) || c.toLowerCase().includes(h)));
  const needC = clearanceRank(job.clearance), haveC = p.clearance?.active === false ? 0 : clearanceRank(p.clearance?.level);
  let score = req.length ? 100 * (1 - missing.length / req.length) : 100;
  if (needC > haveC) score = Math.min(score, 40);
  const notes = [];
  if (missing.length) notes.push(`Missing: ${missing.join(", ")}.`);
  if (needC > haveC) notes.push(`Needs ${CLEARANCE[needC]} clearance.`);
  return { score: clamp(score), note: notes.join(" ") || "You meet the listed credential requirements.", missing };
}

function experienceScore(job, p) {
  const have = (p.experience || []).reduce((s, e) => s + (Number(e.years) || 0), 0);
  const need = job.experience_years;
  if (need == null) return { score: null, note: `You have about ${have} years of experience; requirement not listed.` };
  return { score: need === 0 ? 100 : clamp((have / need) * 100), note: `You have about ${have} years; the job asks for ${need}.` };
}

// Weights for the overall score. Unknown parts are left out and the rest re-weighted.
const WEIGHTS = { skills: 0.3, credentials: 0.25, experience: 0.15, pay: 0.15, commute: 0.15 };
function overall(parts) {
  let sum = 0, w = 0;
  for (const [k, wt] of Object.entries(WEIGHTS)) if (parts[k]?.score != null) { sum += parts[k].score * wt; w += wt; }
  return w ? clamp(sum / w) : null;
}

const SYSTEM = `You are the Scorecard agent of a job search app. For each job, using the applicant profile and the code-computed scores provided:
1. Give a skills match score 0-100 with a one-sentence reason.
2. Estimate probabilities (0-100) for: interview, hire, promotion within 1 year, and still employed at 12, 18, and 24 months.
   Base them on the fit scores, typical competition for the role, and these approximate U.S. patterns (BLS Employee Tenure and JOLTS):
   food service and retail have high turnover (about half of new hires leave within a year); healthcare support and skilled trades are moderate;
   IT, government, and cleared roles have lower turnover; federal jobs have long hiring timelines and high retention.
   Retention must not increase over time (12 >= 18 >= 24). Hire must be <= interview.
3. Give one sentence explaining the estimates and the single most useful action to raise the applicant's chances.
These are estimates, not guarantees. Use only job-related factors. Never use or infer protected traits (race, gender, age, disability, religion, national origin).
${SAFETY}
Reply ONLY with JSON: {"jobs": [{"id": string, "skills": {"score": number, "note": string}, "predictions": {"interview": number, "hire": number, "promotion_1yr": number, "retain_12": number, "retain_18": number, "retain_24": number}, "explanation": string, "improve": string}]}`;

export async function scorecard({ profile = {}, jobs = [], session, prefs }) {
  const home = await geocode(profile.city);
  const mode = profile.commute_mode || "drive";
  const coded = await Promise.all(jobs.slice(0, 8).map(async (job) => {
    const where = job.lat != null ? { lat: job.lat, lng: job.lng } : await geocode(job.city);
    return {
      job,
      parts: {
        commute: commuteScore(job, await commute(home, where, mode), Number(profile.commute_minutes) || 30, mode),
        pay: payScore(job, Number(profile.target_pay)),
        credentials: credentialScore(job, profile),
        experience: experienceScore(job, profile),
      },
    };
  }));

  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "user", content: JSON.stringify({
        applicant: profile,
        jobs: coded.map(({ job, parts }) => ({ id: job.id, title: job.title, company: job.company, mode: job.work_mode,
          skills: job.skills, summary: job.summary, clearance: job.clearance,
          scores: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.score])) })),
      }) },
    ],
    { json: true, agent: "scorecard", session }
  );
  const byId = Object.fromEntries((JSON.parse(text).jobs || []).map((j) => [j.id, j]));

  return coded.map(({ job, parts }) => {
    const ai = byId[job.id] || {};
    const all = { ...parts, skills: ai.skills || { score: null, note: "Not scored." } };
    const p = ai.predictions || {};
    // Enforce the logical rules in code in case the model slips.
    if (p.hire > p.interview) p.hire = p.interview;
    p.retain_18 = Math.min(p.retain_18 ?? 0, p.retain_12 ?? 0);
    p.retain_24 = Math.min(p.retain_24 ?? 0, p.retain_18);
    return { id: job.id, overall: overall(all), parts: all, predictions: p, explanation: ai.explanation, improve: ai.improve };
  });
}
