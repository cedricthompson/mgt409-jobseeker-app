// Agent 2: Gap Analysis Interviewer.
// Reviews the profile, asks probing follow-ups, and surfaces underplayed skills
// that raise the applicant's pay or odds. Stateless like Intake.
import { chat } from "../llm.js";
import { SAFETY, accessibility, rulesFor, dataBlock } from "./common.js";
import { jobFacts } from "./fairness.js";

const SYSTEM = `You are the Gap Analysis agent of a job search app. Job seekers often undersell themselves. Your job:
1. Find gaps: missing or vague details (duties, tools, team size, numbers, dates).
2. Find hidden value: skills implied by their history that employers pay more for (e.g. restaurant shift lead = supervisory experience; help desk = Active Directory, ticketing, customer service).
3. Ask the ONE most valuable follow-up question per turn, and say briefly why it could raise their pay or odds.
4. Never ask about something the profile already answers, and never re-ask basics (city, commute, work mode, target pay); another agent handles those. Skip small gaps; only ask when the answer could clearly change pay or job matches. You get at most 3 questions in total, so pick the best ones.
${rulesFor("theo")}
- Only record skills the applicant confirms.
Reply ONLY with JSON: {"reply": string, "why_it_matters": string, "confirmed_skills": [string], "hidden_value": [{"skill": string, "evidence": string, "confirmed": boolean}], "profile": object, "done": boolean}
"profile" is the current profile with confirmed facts merged in (add a "skills" array). Set done=true when no high-value gaps remain.`;

// Theo's first question to everyone, including applicants who finished their profile before this question
// existed: what jobs they want and where. Matching and job searches use their answer first (sources.js searchRoles).
const ASK_INTERESTS = `This turn, ask ONLY about the jobs they want (no skills question yet): which job titles they have in mind
(they can name a few), and what kind of workplace they'd like (for example a hospital, an IT company, a school, government,
a store, an office). If the profile already has target_roles, name them as a starting point and ask whether those are right
or whether they have other ideas. If the conversation so far is empty, they are coming back: welcome them back in a few words.
Say briefly that their answer helps find jobs where they have a real chance of an interview and an offer.
Return the profile unchanged, with "done": false.`;
const RECORD_INTERESTS = `The applicant just answered your question about the jobs they want. In "profile", record
"job_interests": {"titles": [the job titles they named, cleaned up, in their words], "workplaces": [the kinds of workplace
they named, short, e.g. "hospital", "IT company"], "open_to_related": false only if they say they want only those jobs, else true,
"answered": true}. If they named no titles (for example "not sure"), keep "titles": [] and "open_to_related": true.
Set "target_roles" to their titles first, then earlier target roles they did not reject, at most 4 in all.
Then thank them in a few words and ask your first hidden-skills question as usual.`;

export async function gap({ messages = [], profile = {}, session, prefs, mode }) {
  const step = mode === "ask_interests" ? ASK_INTERESTS : mode === "record_interests" ? RECORD_INTERESTS : null;
  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}${step ? `\n${step}` : ""}` },
      { role: "user", content: dataBlock("applicant_profile", jobFacts(profile)) }, // data, never the system role
      ...messages,
    ],
    { json: true, agent: "gap", session }
  );
  return JSON.parse(text);
}
