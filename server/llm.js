// Loads .env (repo folder first, then one level up) and calls the course model via Portkey.
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const p of [resolve(repoRoot, ".env"), resolve(repoRoot, "..", ".env")]) {
  if (existsSync(p)) { process.loadEnvFile(p); break; }
}

const BASE_URL = process.env.PORTKEY_BASE_URL || "https://api.portkey.ai/v1";
const MODEL = process.env.MODEL || "gpt-6-luna";

// Running token totals, reported in the tokenomics section of the report.
export const usage = { calls: 0, prompt_tokens: 0, completion_tokens: 0 };

export async function chat(messages, { json = false } = {}) {
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
  usage.calls++;
  usage.prompt_tokens += data.usage?.prompt_tokens ?? 0;
  usage.completion_tokens += data.usage?.completion_tokens ?? 0;
  return { text: data.choices[0].message.content, usage: data.usage };
}
