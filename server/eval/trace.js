// Traced end-to-end run for the report: runs every agent in order for sample applicants and records,
// for each step, which agent ran, how long it took, the tokens used, and a short summary of the output.
// Usage: node server/eval/trace.js   (writes evidence/trace.json and evidence/trace.md)
// The answer cache is turned off (CACHE_HOURS=0) so token counts are real, first-time costs.
process.env.CACHE_HOURS = "0";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "../env.js";
import { usage } from "../llm.js";
import { importResume } from "../agents/import.js";
import { profileChat } from "../agents/orchestrator.js";
import { matchJobs } from "../agents/matcher.js";
import { scorecard } from "../agents/scorecard.js";
import { coach } from "../agents/coach.js";

const PERSONAS = [
  {
    name: "Andre (DC, IT help desk, Secret clearance)",
    resume: "Andre Wilson, Columbia Heights, Washington DC. IT Help Desk at Johns Hopkins for 3 years: Active Directory, ServiceNow tickets, laptop imaging. CompTIA A+ and Security+. Active Secret clearance. High school diploma. Looking for IT Specialist roles, hybrid, $65,000, up to 45 minutes.",
    answer: "I usually handled about 40 tickets a week and trained two new help desk staff.",
  },
  {
    name: "Maria (Columbus, line cook to kitchen manager)",
    resume: "Maria Gomez, Columbus OH. Line cook at Applebee's 3 years, trained new hires and ran the grill station on weekends. ServSafe Manager. GED. Want a kitchen manager job, $50,000, within 25 minutes, drive, on site.",
    answer: "Yes, I led 4 cooks on weekend shifts and made the prep schedule.",
  },
];

const tokensNow = () => ({ p: usage.total.prompt_tokens, c: usage.total.completion_tokens, calls: usage.total.calls });

async function step(trace, agent, fn, summarize) {
  const before = tokensNow(), t0 = Date.now();
  const out = await fn();
  const after = tokensNow();
  trace.push({ agent, ms: Date.now() - t0, model_calls: after.calls - before.calls,
    prompt_tokens: after.p - before.p, completion_tokens: after.c - before.c, summary: summarize(out) });
  return out;
}

const runs = [];
for (const persona of PERSONAS) {
  const session = `trace-${persona.name.split(" ")[0].toLowerCase()}`;
  const trace = [];
  const imp = await step(trace, "Intake (resume import)", () => importResume({ kind: "text", data: persona.resume, session }),
    (r) => `${r.summary} Missing: ${(r.missing || []).join(", ") || "none"}.`);
  const q1 = await step(trace, "Orchestrator -> Intake/Gap", () => profileChat({ profile: imp.profile, messages: [], session }),
    (r) => `[${r.agent}] ${r.reply}`);
  const q2 = await step(trace, "Orchestrator -> Intake/Gap (answer)", () => profileChat({ profile: q1.profile, session,
    messages: [{ role: "assistant", content: q1.reply }, { role: "user", content: persona.answer }] }),
    (r) => `[${r.agent}] ${r.reply}`);
  const m = await step(trace, "Job Matcher", () => matchJobs({ profile: q2.profile, session }),
    (r) => `${r.considered} jobs considered (${r.data} data); top: ${r.matches.slice(0, 3).map((x) => `${x.job.title} (${x.fit})`).join("; ")}`);
  const top = m.matches.slice(0, 3);
  const s = await step(trace, "Scorecard", () => scorecard({ profile: q2.profile, jobs: top.map((x) => x.job), session }),
    (r) => r.map((c) => `${c.overall}/100 (interview ${c.predictions.interview}%, hire ${c.predictions.hire}%)`).join("; "));
  await step(trace, "Application Coach (cover letter)", () => coach({ task: "cover_letter", profile: q2.profile, job: top[0]?.job, session }),
    (r) => `${r.content.split(/\s+/).length} words; tips: ${(r.tips || []).join(" | ")}`);
  const totals = trace.reduce((a, t) => ({ calls: a.calls + t.model_calls, prompt: a.prompt + t.prompt_tokens,
    completion: a.completion + t.completion_tokens, ms: a.ms + t.ms }), { calls: 0, prompt: 0, completion: 0, ms: 0 });
  runs.push({ persona: persona.name, steps: trace, totals, scores: s.map((c) => c.overall) });
  console.log(`${persona.name}: ${totals.calls} calls, ${totals.prompt + totals.completion} tokens, ${(totals.ms / 1000).toFixed(1)}s`);
}

const dir = resolve(repoRoot, "evidence");
mkdirSync(dir, { recursive: true });
writeFileSync(resolve(dir, "trace.json"), JSON.stringify({ when: new Date().toISOString(), model: process.env.MODEL || "gpt-6-luna", runs }, null, 2));

let md = `# Traced agent runs\n\nRun on ${new Date().toISOString().slice(0, 10)} with ${process.env.MODEL || "gpt-6-luna"}. Cache off, so these are first-time token costs.\n`;
for (const r of runs) {
  md += `\n## ${r.persona}\n\n| Step | Agent | Time | Calls | Prompt tokens | Completion tokens | Output |\n|---|---|---|---|---|---|---|\n`;
  r.steps.forEach((t, i) => { md += `| ${i + 1} | ${t.agent} | ${(t.ms / 1000).toFixed(1)}s | ${t.model_calls} | ${t.prompt_tokens} | ${t.completion_tokens} | ${t.summary.replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 220)} |\n`; });
  md += `| | **Total** | **${(r.totals.ms / 1000).toFixed(1)}s** | **${r.totals.calls}** | **${r.totals.prompt}** | **${r.totals.completion}** | **${r.totals.prompt + r.totals.completion} tokens per applicant** |\n`;
}
writeFileSync(resolve(dir, "trace.md"), md);
console.log("Wrote evidence/trace.json and evidence/trace.md");
