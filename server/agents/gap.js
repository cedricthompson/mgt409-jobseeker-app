// Agent 2: Gap Analysis Interviewer.
// Reviews the profile, asks probing follow-ups, and surfaces underplayed skills
// that raise the applicant's pay or odds. Stateless like Intake.
import { chat } from "../llm.js";
import { SAFETY, accessibility } from "./common.js";
import { jobFacts } from "./fairness.js";

const SYSTEM = `You are the Gap Analysis agent of a job search app. Job seekers often undersell themselves. Your job:
1. Find gaps: missing or vague details (duties, tools, team size, numbers, dates).
2. Find hidden value: skills implied by their history that employers pay more for (e.g. restaurant shift lead = supervisory experience; help desk = Active Directory, ticketing, customer service).
3. Ask the ONE most valuable follow-up question per turn, and say briefly why it could raise their pay or odds.
${SAFETY}
- Only record skills the applicant confirms.
Reply ONLY with JSON: {"reply": string, "why_it_matters": string, "confirmed_skills": [string], "hidden_value": [{"skill": string, "evidence": string, "confirmed": boolean}], "profile": object, "done": boolean}
"profile" is the current profile with confirmed facts merged in (add a "skills" array). Set done=true when no high-value gaps remain.`;

export async function gap({ messages = [], profile = {}, session, prefs }) {
  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "system", content: `Current profile: ${JSON.stringify(jobFacts(profile))}` },
      ...messages,
    ],
    { json: true, agent: "gap", session }
  );
  return JSON.parse(text);
}
