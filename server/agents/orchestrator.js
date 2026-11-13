// Orchestrator: decides which agent handles the next profile-chat turn.
// The routing check is plain code, so it costs no tokens.
import { intake } from "./intake.js";
import { gap } from "./gap.js";
import { revisit } from "./revisit.js";

const filled = (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

export function missingBasics(p = {}) {
  const required = { city: p.city, commute: p.commute_minutes, "work mode": p.work_mode, education: p.education,
    experience: p.experience, "target roles": p.target_roles, "target pay": p.target_pay };
  return Object.entries(required).filter(([, v]) => !filled(v)).map(([k]) => k);
}

// Turn everyday words into the values the commute estimate understands ("Metro" -> transit).
function normalize(p = {}) {
  const m = String(p.commute_mode || "").toLowerCase();
  const mode = /metro|bus|train|subway|transit|rail|mta|wmata/.test(m) ? "transit"
    : /car|driv/.test(m) ? "drive" : /bike|bicycl|cycl/.test(m) ? "bike" : /walk|foot/.test(m) ? "walk" : p.commute_mode ?? null;
  return { ...p, commute_mode: mode };
}

// Theo asks what jobs the applicant wants (titles and kinds of workplace) before anything else, then up to 3
// hidden-skills questions. The job-interests question is also asked of applicants who finished their profile
// before it existed, the next time they open the chat, so their matches can use the answer.
const MAX_GAP_QUESTIONS = 4;

// "ask_interests" until Theo has asked; "record_interests" on the turn the applicant answers; then null.
function interestsMode(p = {}, messages = []) {
  if (p.job_interests?.answered) return null;
  const answering = p.job_interests?.asked && messages.at(-1)?.role === "user";
  return answering ? "record_interests" : "ask_interests";
}
// Make sure the job-interests step moves forward even if the model leaves the field out, so it is never asked twice.
function withInterests(next = {}, prev = {}, mode) {
  if (mode === "ask_interests") return { ...next, job_interests: { ...(prev.job_interests || {}), asked: true } };
  if (mode === "record_interests") {
    const j = next.job_interests || {};
    const list = (v) => (Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 5) : []);
    return { ...next, job_interests: { titles: list(j.titles), workplaces: list(j.workplaces), open_to_related: j.open_to_related !== false, answered: true } };
  }
  return { ...next, job_interests: next.job_interests || prev.job_interests };
}
// The app sends the whole chat each turn, with each assistant turn tagged by the agent that wrote it.
function gapQuestionsAsked(messages = []) {
  return messages.filter((m) => m.role === "assistant" && m.agent === "gap").length;
}

export async function profileChat(body) {
  try {
    return await routeTurn(body);
  } catch (err) {
    if (err.code !== "content_filter") throw err;
    // The provider's safety filter blocked the message: answer kindly and keep the profile unchanged.
    return { agent: "safety", reply: "I can't help with that, but I'm happy to keep working on your job search. What would you like to do next?",
      profile: body.profile || {}, missing: missingBasics(body.profile), done: false, blocked: true };
  }
}

async function routeTurn(raw) {
  // The model only accepts role and content, so the agent tag is removed before any agent sees the chat.
  const body = { ...raw, messages: (raw.messages || []).map(({ role, content }) => ({ role, content })) };
  // Coming back from the matches page to talk with one chosen coach (see revisit.js).
  if (raw.coach) {
    const r = await revisit(body);
    return { agent: raw.coach, reply: r.reply, changed: r.changed || [], profile: normalize(r.profile), missing: missingBasics(r.profile), done: Boolean(r.done) };
  }
  const missing = missingBasics(body.profile);
  if (missing.length > 0) {
    const r = await intake(body);
    const profile = normalize(r.profile);
    const stillMissing = missingBasics(profile);
    if (stillMissing.length > 0) return { agent: "intake", reply: r.reply, profile, missing: stillMissing, done: false };
    // Basics are now complete: go straight to Theo's first question (the jobs they want) in the same turn,
    // so the applicant never has to reply to a message that asks nothing.
    const mode = interestsMode(profile, []);
    const g = await gap({ ...body, profile, mode, messages: [...body.messages, { role: "assistant", content: r.reply }] });
    return { agent: "gap", reply: `${r.reply} ${g.reply}`, why: g.why_it_matters, hidden_value: g.hidden_value,
      profile: normalize(withInterests(g.profile, profile, mode)), missing: [], done: mode ? false : Boolean(g.done) };
  }
  // Gap analysis gets at most MAX_GAP_QUESTIONS questions, enforced here so a long interview can't happen.
  const asked = gapQuestionsAsked(raw.messages);
  const mode = interestsMode(body.profile, body.messages);
  const r = await gap({ ...body, mode });
  const profile = normalize(withInterests(r.profile, body.profile, mode));
  if (asked >= MAX_GAP_QUESTIONS) {
    return { agent: "gap", reply: "Thank you. Your profile is ready, so let's look at jobs that fit you.",
      hidden_value: r.hidden_value, profile, missing: [], done: true };
  }
  return { agent: "gap", reply: r.reply, why: r.why_it_matters, hidden_value: r.hidden_value,
    profile, missing: [], done: mode === "ask_interests" ? false : Boolean(r.done) || asked + 1 >= MAX_GAP_QUESTIONS };
}
