// Orchestrator: decides which agent handles the next profile-chat turn.
// The routing check is plain code, so it costs no tokens.
import { intake } from "./intake.js";
import { gap } from "./gap.js";

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

const MAX_GAP_QUESTIONS = 3;
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
  const missing = missingBasics(body.profile);
  if (missing.length > 0) {
    const r = await intake(body);
    const profile = normalize(r.profile);
    const stillMissing = missingBasics(profile);
    if (stillMissing.length > 0) return { agent: "intake", reply: r.reply, profile, missing: stillMissing, done: false };
    // Basics are now complete: go straight to the first gap question in the same turn,
    // so the applicant never has to reply to a message that asks nothing.
    const g = await gap({ ...body, profile, messages: [...body.messages, { role: "assistant", content: r.reply }] });
    return { agent: "gap", reply: `${r.reply} ${g.reply}`, why: g.why_it_matters, hidden_value: g.hidden_value,
      profile: normalize(g.profile), missing: [], done: Boolean(g.done) };
  }
  // Gap analysis gets at most MAX_GAP_QUESTIONS questions, enforced here so a long interview can't happen.
  const asked = gapQuestionsAsked(raw.messages);
  const r = await gap(body);
  if (asked >= MAX_GAP_QUESTIONS) {
    return { agent: "gap", reply: "Thank you. Your profile is ready, so let's look at jobs that fit you.",
      hidden_value: r.hidden_value, profile: normalize(r.profile), missing: [], done: true };
  }
  return { agent: "gap", reply: r.reply, why: r.why_it_matters, hidden_value: r.hidden_value,
    profile: normalize(r.profile), missing: [], done: Boolean(r.done) || asked + 1 >= MAX_GAP_QUESTIONS };
}
