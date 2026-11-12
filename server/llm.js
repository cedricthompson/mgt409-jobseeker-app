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
const cache = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, "utf8")) : {};
const cacheKey = (body) => createHash("sha256").update(JSON.stringify(body)).digest("hex");

// `effort` ("low" | "medium" | "high") limits how long the model thinks before answering.
// Hidden thinking was most of the Job Matcher's ~40 seconds, and ranking a short list doesn't need it.
// If the model rejects the setting, the call is retried without it and the setting is skipped from then on.
let effortSupported = true;
let effortError = null;
// Shown on /api/health: which model answers, and whether the speed setting is being used.
export const modelStatus = () => ({ model: MODEL, effort: effortSupported ? "used" : `off: ${effortError}` });

export async function chat(messages, { json = false, agent = "other", session = "anonymous", useCache = true, effort } = {}) {
  const body = { model: MODEL, messages, ...(json && { response_format: { type: "json_object" } }),
    ...(effort && effortSupported && { reasoning_effort: effort }) };
  const key = cacheKey(body);
  const hit = useCache && cache[key];
  const hours = Number(process.env.CACHE_HOURS ?? 24); // read per call, so scripts can turn the cache off
  if (hit && Date.now() - hit.at < hours * 3600e3) {
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
  if (!res.ok) {
    const detail = await res.text();
    if (body.reasoning_effort && res.status === 400 && /reasoning/i.test(detail)) {
      effortSupported = false;
      effortError = detail.slice(0, 200);
      console.warn(`Model doesn't accept reasoning_effort; continuing without it. ${detail.slice(0, 200)}`);
      return chat(messages, { json, agent, session, useCache });
    }
    if (detail.includes("content_filter")) throw Object.assign(new Error("I can't help with that request. Please rephrase it as a question about your job search."), { code: "content_filter", status: 400 });
    throw new Error(`Model call failed (${res.status}): ${detail}`);
  }

  const data = await res.json();
  const text = data.choices[0].message.content;
  record(agent, session, data.usage);
  if (useCache) {
    cache[key] = { at: Date.now(), text, usage: data.usage };
    writeFileSync(CACHE_FILE, JSON.stringify(cache));
  }
  return { text, usage: data.usage, cached: false };
}
