// Agent 4: Scorecard / Predictor.
// Part 1 (code, no tokens, fully explainable): commute, pay, credentials, and experience scores, 0-100.
// Part 2 (one model call for new jobs only): the model labels each job (family, level, competition) and rates the skills match.
// Part 3 (code, no tokens): fixed rules turn the labels and fit into odds (interview, hire, promotion within a year,
//   still employed at 12/18/24 months), so the same applicant and job always get the same numbers. See predict().
import { chat } from "../llm.js";
import { geocode, commute } from "../geo.js";
import { SAFETY, accessibility } from "./common.js";
import { jobFacts } from "./fairness.js";
import { recall, remember } from "../memo.js";
import { createHash } from "node:crypto";

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
function commuteScore(job, { minutes, method, mode, system, note }, max = 30) {
  if (job.work_mode === "remote") return { score: 100, note: "Remote job: no commute." };
  if (minutes == null) return { score: null, note: "Commute unknown (job location not specific)." };
  const score = minutes <= max ? 100 : clamp(100 - ((minutes - max) / max) * 100);
  const by = system ? `by ${system}` : MODE_WORDS[mode] || "driving";
  const how = `${method === "routed" ? "" : "About "}${minutes} min each way ${by}${method === "routed" ? " (real schedule)" : " (estimate)"}`;
  return { score, note: `${how}${note ? `, ${note}` : ""}; your limit is ${max}.` };
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

// Weights for the overall score. An unknown part counts as a neutral 50, so missing
// information neither inflates nor sinks a job.
const WEIGHTS = { skills: 0.3, credentials: 0.25, experience: 0.15, pay: 0.15, commute: 0.15 };
function overall(parts) {
  let sum = 0;
  for (const [k, wt] of Object.entries(WEIGHTS)) sum += (parts[k]?.score ?? 50) * wt;
  return clamp(sum);
}

// ---- Predictions: fixed rules in code, so the same applicant and job always get the same odds ----
// The model only labels the job (its family, level, and how competitive it is) and rates the skills match.
// Code turns those labels and the fit scores into odds. Starting points per job family are approximate
// U.S. patterns from BLS Employee Tenure and JOLTS (quits and hires) data and typical applicant-to-interview
// ratios. They are planning estimates, not guarantees.
//   interview: chance an average-fit applicant gets an interview; hire: chance of an offer after interviewing;
//   promo: promotion within a year; r12/r18/r24: still employed there at 12, 18, 24 months.
export const FAMILIES = {
  food_service:            { label: "food service",                 interview: 35, hire: 0.50, promo: 15, r12: 50, r18: 40, r24: 33 },
  retail:                  { label: "retail",                       interview: 30, hire: 0.45, promo: 12, r12: 55, r18: 45, r24: 38 },
  transportation_warehouse:{ label: "transportation and warehouse", interview: 35, hire: 0.50, promo: 10, r12: 55, r18: 45, r24: 38 },
  healthcare_support:      { label: "healthcare support",           interview: 30, hire: 0.45, promo: 10, r12: 68, r18: 60, r24: 53 },
  healthcare_professional: { label: "healthcare professional",      interview: 35, hire: 0.45, promo: 10, r12: 80, r18: 73, r24: 67 },
  skilled_trades:          { label: "skilled trades",               interview: 30, hire: 0.45, promo: 12, r12: 72, r18: 64, r24: 57 },
  office_admin:            { label: "office and administrative",    interview: 18, hire: 0.35, promo: 10, r12: 72, r18: 64, r24: 57 },
  education:               { label: "education",                    interview: 20, hire: 0.40, promo: 6,  r12: 82, r18: 75, r24: 70 },
  it_tech:                 { label: "IT and technology",            interview: 15, hire: 0.30, promo: 12, r12: 78, r18: 70, r24: 63 },
  management_professional: { label: "management and professional",  interview: 12, hire: 0.30, promo: 10, r12: 80, r18: 72, r24: 65 },
  government_federal:      { label: "federal government",           interview: 12, hire: 0.30, promo: 8,  r12: 88, r18: 84, r24: 80 },
  other:                   { label: "general",                      interview: 20, hire: 0.35, promo: 10, r12: 70, r18: 62, r24: 55 },
};
const COMPETITION = { low: 1.25, medium: 1, high: 0.7 };
const LEVEL = { entry: 1.2, mid: 1, senior: 0.7 };
const range = (lo, hi) => (n) => Math.max(lo, Math.min(hi, Math.round(n)));

export function predict(labels, fit, parts) {
  const fam = FAMILIES[labels.family] || FAMILIES.other;
  const comp = COMPETITION[labels.competition] ?? 1, level = LEVEL[labels.level] ?? 1;
  const f = fit / 100; // overall fit, 0 to 1
  const interview = range(2, 90)(fam.interview * (0.4 + 1.2 * f) * comp);
  const hire = Math.min(interview, range(1, 80)(interview * fam.hire * (0.6 + 0.8 * f)));
  const promotion_1yr = range(1, 50)(fam.promo * (0.6 + 0.8 * f) * level);
  // Long commutes and pay below target are two of the most common reasons people leave a new job.
  let adjust = 0;
  if (parts.commute?.score != null && parts.commute.score < 60) adjust -= 8;
  if (parts.pay?.score != null) adjust += parts.pay.score < 60 ? -6 : parts.pay.score >= 90 ? 4 : 0;
  const r = range(5, 97);
  const retain_12 = r(fam.r12 + adjust), retain_18 = Math.min(retain_12, r(fam.r18 + adjust)), retain_24 = Math.min(retain_18, r(fam.r24 + adjust));
  const basis = `Based on typical patterns for ${fam.label} jobs (about ${fam.r12}% of new hires are still there after a year), ` +
    `${labels.competition || "medium"} competition, and your fit of ${fit} out of 100` +
    `${adjust < 0 ? ", lowered a little for the commute or pay" : adjust > 0 ? ", raised a little because the pay meets your target" : ""}.`;
  return { predictions: { interview, hire, promotion_1yr, retain_12, retain_18, retain_24 }, basis };
}

const SYSTEM = `You are the Scorecard agent of a job search app. For each job, using the applicant profile:
1. "family": the job family, one of: ${Object.keys(FAMILIES).join(", ")}. Use government_federal for U.S. federal agency jobs.
2. "level": entry, mid, or senior.
3. "competition": low, medium, or high (how many qualified applicants such a job usually draws; remote and well-paid professional jobs are high).
4. "skills": a skills match score 0-100 (a multiple of 5) with a one-sentence reason, judged only from the applicant's real skills and experience.
5. "explanation": one sentence on what most helps or hurts this applicant's chances. Do not state percentages.
6. "improve": the single most useful action to raise the applicant's chances.
Use only job-related factors. Never use or infer protected traits (race, gender, age, disability, religion, national origin).
${SAFETY}
Reply ONLY with JSON: {"jobs": [{"id": string, "family": string, "level": string, "competition": string, "skills": {"score": number, "note": string}, "explanation": string, "improve": string}]}`;

const jobView = (job) => ({ title: job.title, company: job.company, city: job.city, mode: job.work_mode, skills: job.skills,
  summary: job.summary, clearance: job.clearance, certs: job.required_certs, exp_years: job.experience_years });
const hash = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

export async function scorecard({ profile = {}, jobs = [], session, prefs }) {
  const home = await geocode(profile.city);
  const coded = await Promise.all(jobs.slice(0, 8).map(async (job) => {
    const where = job.lat != null ? { lat: job.lat, lng: job.lng } : await geocode(job.city);
    return {
      job,
      parts: {
        commute: commuteScore(job, await commute(home, where, profile.commute_mode), Number(profile.commute_minutes) || 30),
        pay: payScore(job, Number(profile.target_pay)),
        credentials: credentialScore(job, profile),
        experience: experienceScore(job, profile),
      },
    };
  }));

  // Look up judgments already made for this applicant and job; ask the model only about new ones.
  const applicant = jobFacts(profile);
  const lang = accessibility(prefs);
  const keyOf = (job) => hash({ v: 1, SYSTEM, lang, applicant, job: jobView(job) });
  const keys = coded.map(({ job }) => keyOf(job));
  const known = await recall(keys);
  const todo = coded.filter((_, i) => !known[keys[i]]);
  if (todo.length) {
    const { text } = await chat(
      [
        { role: "system", content: `${SYSTEM}\n${lang}` },
        { role: "user", content: JSON.stringify({ applicant, jobs: todo.map(({ job }, i) => ({ id: String(i), ...jobView(job) })) }) },
      ],
      { json: true, agent: "scorecard", session }
    );
    const fresh = [];
    for (const j of JSON.parse(text).jobs || []) {
      const item = todo[Number(j.id)];
      if (!item) continue;
      const value = {
        family: FAMILIES[j.family] ? j.family : "other", level: LEVEL[j.level] ? j.level : "mid",
        competition: COMPETITION[j.competition] ? j.competition : "medium",
        skills: { score: Number.isFinite(j.skills?.score) ? Math.round(j.skills.score / 5) * 5 : null, note: j.skills?.note || "" },
        explanation: j.explanation || "", improve: j.improve || "",
      };
      const key = keyOf(item.job);
      known[key] = value;
      fresh.push([key, value]);
    }
    await remember(fresh);
  }

  return coded.map(({ job, parts }, i) => {
    const ai = known[keys[i]] || {};
    const all = { ...parts, skills: ai.skills?.score != null ? ai.skills : { score: null, note: "Not scored." } };
    const fit = overall(all);
    const { predictions, basis } = predict(ai, fit, all);
    return { id: job.id, overall: fit, parts: all, predictions, basis, labels: { family: ai.family, level: ai.level, competition: ai.competition },
      explanation: ai.explanation, improve: ai.improve };
  });
}
