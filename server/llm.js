// Calls the course model via Portkey, caches answers, and tracks token use.
import { createHash } from "node:crypto";
import { mkdirSync, appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./env.js";

const BASE_URL = process.env.PORTKEY_BASE_URL || "https://api.portkey.ai/v1";
const MODEL = process.env.MODEL || "gpt-6-luna";

// Token tracking for the tokenomics section of the report: totals, per agent, and
// per applicant session. Every call is also appended to logs/tokens.jsonl.
// "cached" counts answers served from our cache (0 tokens spent) and the tokens that saved.
const LOG_DIR = resolve(repoRoot, "server", "logs");
mkdirSync(LOG_DIR, { recursive: true });
const emptyTally = () => ({ calls: 0, prompt_tokens: 0, completion_tokens: 0, provider_cached_tokens: 0, cache_hits: 0, tokens_saved: 0 });
export const usage = { total: emptyTally(), byAgent: {}, bySession: {} };

function record(agent, session, u, hit = false) {
  const p = u?.prompt_tokens ?? 0, c = u?.completion_tokens ?? 0, pc = u?.prompt_tokens_details?.cached_tokens ?? 0;
  for (const t of [usage.total, (usage.byAgent[agent] ??= emptyTally()), (usage.bySession[session] ??= emptyTally())]) {
    t.calls++;
    if (hit) { t.cache_hits++; t.tokens_saved += p + c; }
    else { t.prompt_tokens += p; t.completion_tokens += c; t.provider_cached_tokens += pc; }
  }
  appendFileSync(resolve(LOG_DIR, "tokens.jsonl"), JSON.stringify({
    time: new Date().toISOString(), agent, session, cache_hit: hit,
    prompt_tokens: hit ? 0 : p, completion_tokens: hit ? 0 : c, provider_cached_tokens: hit ? 0 : pc, tokens_saved: hit ? p + c : 0,
  }) + "\n");
}

// Answer cache: the same agent instructions + the same input return the saved answer instead of
// calling the model again (for example, reopening matches for an unchanged profile).
// Kept on disk so it survives restarts; entries expire after CACHE_HOURS.
const CACHE_FILE = resolve(LOG_DIR, "llm-cache.json");
const CACHE_HOURS = Number(process.env.CACHE_HOURS || 24);
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
const cacheKey = (body) => createHash("sha256").update(JSON.stringify(body)).digest("hex");

export async function chat(messages, { json = false, agent = "other", session = "anonymous", useCache = true } = {}) {
  const body = { model: MODEL, messages, ...(json && { response_format: { type: "json_object" } }) };
  const key = cacheKey(body);
  const hit = useCache && cache[key];
  if (hit && Date.now() - hit.at < CACHE_HOURS * 3600e3) {
    record(agent, session, hit.usage, true);
    return { text: hit.text, usage: hit.usage, cached: true };
  }

  const apiKey = process.env.PORTKEY_API_KEY;
  if (!apiKey) throw new Error("PORTKEY_API_KEY is missing. Copy .env.example to .env and add it.");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-portkey-api-key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Model call failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  const text = data.choices[0].message.content;
  record(agent, session, data.usage);
  if (useCache) {
    cache[key] = { at: Date.now(), text, usage: data.usage };
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  }
  return { text, usage: data.usage, cached: false };
}
