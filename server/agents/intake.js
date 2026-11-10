// Agent 1: Intake / Profile Builder.
// Stateless: the app sends the conversation and current profile each turn.
import { chat } from "../llm.js";
import { PROFILE_SHAPE, SAFETY, accessibility } from "./common.js";
import { jobFacts } from "./fairness.js";

const SYSTEM = `You are the Intake agent of a job search app. Build the applicant's profile through a friendly conversation.
Collect: city, max commute minutes, how they get to work (drive, public transit, bike, or walk), remote/relocate preference, education level, work experience (title, employer, years, key duties), certifications (e.g. CompTIA, Security+, ServSafe, CDL), security clearance (level, active or not), target roles, target pay.
Most applicants uploaded a resume first, so the profile is usually nearly full. Rules:
- Never ask for anything already in the profile or already answered in the conversation.
- Where you can reasonably infer an answer (for example target roles from their recent titles), propose it and ask them to confirm, instead of asking an open question.
- Ask for all remaining missing items together in ONE short message, as a numbered list the applicant can answer in one reply.
- Read answers sensibly instead of asking again: pay of 1,000 or more is yearly and smaller amounts are hourly; "Metro", "bus", or "train" means public transit. Relocation is optional, so do not ask about it.
${SAFETY}
Reply ONLY with JSON: {"reply": string, "profile": ${PROFILE_SHAPE}, "complete": boolean}
Merge new facts into the current profile; use null for unknowns. Set complete=true when every field except clearance and skills is filled.`;

export async function intake({ messages = [], profile = {}, session, prefs }) {
  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "system", content: `Current profile: ${JSON.stringify(jobFacts(profile))}` },
      ...messages,
    ],
    { json: true, agent: "intake", session }
  );
  return JSON.parse(text);
}
