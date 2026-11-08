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

async function routeTurn(body) {
  const missing = missingBasics(body.profile);
  if (missing.length > 0) {
    const r = await intake(body);
    return { agent: "intake", reply: r.reply, profile: r.profile, missing: missingBasics(r.profile), done: false };
  }
  const r = await gap(body);
  return { agent: "gap", reply: r.reply, why: r.why_it_matters, hidden_value: r.hidden_value,
    profile: r.profile, missing: [], done: Boolean(r.done) };
}
