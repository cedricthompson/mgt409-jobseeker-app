// Calls the course model via Portkey and tracks token use.
import { mkdirSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./env.js";

const BASE_URL = process.env.PORTKEY_BASE_URL || "https://api.portkey.ai/v1";
const MODEL = process.env.MODEL || "gpt-6-luna";

// Token tracking for the tokenomics section of the report: totals, per agent, and
// per applicant session. Every call is also appended to logs/tokens.jsonl.
const LOG_DIR = resolve(repoRoot, "server", "logs");
mkdirSync(LOG_DIR, { recursive: true });
const emptyTally = () => ({ calls: 0, prompt_tokens: 0, completion_tokens: 0 });
export const usage = { total: emptyTally(), byAgent: {}, bySession: {} };

function record(agent, session, u) {
  const p = u?.prompt_tokens ?? 0, c = u?.completion_tokens ?? 0;
  for (const t of [usage.total, (usage.byAgent[agent] ??= emptyTally()), (usage.bySession[session] ??= emptyTally())]) {
    t.calls++; t.prompt_tokens += p; t.completion_tokens += c;
  }
  appendFileSync(resolve(LOG_DIR, "tokens.jsonl"),
    JSON.stringify({ time: new Date().toISOString(), agent, session, prompt_tokens: p, completion_tokens: c }) + "\n");
}

export async function chat(messages, { json = false, agent = "other", session = "anonymous" } = {}) {
  const key = process.env.PORTKEY_API_KEY;
  if (!key) throw new Error("PORTKEY_API_KEY is missing. Copy .env.example to .env and add it.");

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-portkey-api-key": key },
    body: JSON.stringify({
      model: MODEL,
      messages,
      ...(json && { response_format: { type: "json_object" } }),
    }),
  });
  if (!res.ok) throw new Error(`Model call failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  record(agent, session, data.usage);
  return { text: data.choices[0].message.content, usage: data.usage };
}
