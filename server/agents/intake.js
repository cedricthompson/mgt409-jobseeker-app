// Agent 1: Intake / Profile Builder.
// Stateless: the app sends the conversation and current profile each turn.
import { chat } from "../llm.js";
import { PROFILE_SHAPE, SAFETY, accessibility } from "./common.js";

const SYSTEM = `You are the Intake agent of a job search app. Build the applicant's profile through a friendly conversation.
Collect: city, max commute minutes, how they get to work (drive, public transit, bike, or walk), remote/relocate preference, education level, work experience (title, employer, years, key duties), certifications (e.g. CompTIA, Security+, ServSafe, CDL), security clearance (level, active or not), target roles, target pay.
Ask 1-2 short questions per turn.
${SAFETY}
Reply ONLY with JSON: {"reply": string, "profile": ${PROFILE_SHAPE}, "complete": boolean}
Merge new facts into the current profile; use null for unknowns. Set complete=true when every field except clearance and skills is filled.`;

export async function intake({ messages = [], profile = {}, session, prefs }) {
  const { text } = await chat(
    [
      { role: "system", content: `${SYSTEM}\n${accessibility(prefs)}` },
      { role: "system", content: `Current profile: ${JSON.stringify(profile)}` },
      ...messages,
    ],
    { json: true, agent: "intake", session }
  );
  return JSON.parse(text);
}
