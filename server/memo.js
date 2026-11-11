// Saved model judgments, so the same applicant checking the same job always gets the same answer
// (and no tokens are spent the second time). Stored in Postgres when DATABASE_URL is set, so it
// survives restarts on the live site; otherwise in server/logs/judgments.json.
// Keys are hashes of the exact model input (no protected traits ever reach it; see fairness.js).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./env.js";

const DAYS = 30; // after a month the judgment is made fresh, in case the posting or profile wording changed

let backend;
async function store() {
  backend ??= (async () => {
    if (process.env.DATABASE_URL) {
      try {
        const { default: pg } = await import("pg");
        const url = process.env.DATABASE_URL;
        const pool = new pg.Pool({ connectionString: url, max: 2, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
        await pool.query("CREATE TABLE IF NOT EXISTS judgments (key TEXT PRIMARY KEY, value JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
        return {
          async get(keys) {
            const { rows } = await pool.query(`SELECT key, value FROM judgments WHERE key = ANY($1) AND created_at > now() - interval '${DAYS} days'`, [keys]);
            return Object.fromEntries(rows.map((r) => [r.key, r.value]));
          },
          async put(entries) {
            for (const [key, value] of entries) {
              await pool.query("INSERT INTO judgments (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, created_at = now()", [key, value]);
            }
          },
        };
      } catch (err) {
        console.error("Judgment store: database unavailable, using memory.", err.message);
      }
    }
    const file = resolve(repoRoot, "server", "logs", "judgments.json");
    const data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    const fresh = (e) => e && Date.now() - e.at < DAYS * 86400e3;
    return {
      async get(keys) { return Object.fromEntries(keys.filter((k) => fresh(data[k])).map((k) => [k, data[k].value])); },
      async put(entries) { for (const [k, value] of entries) data[k] = { at: Date.now(), value }; writeFileSync(file, JSON.stringify(data)); },
    };
  })();
  return backend;
}

// Never let the memo break scoring: on any error, behave as if nothing was saved.
export async function recall(keys) {
  if (process.env.CACHE_HOURS === "0") return {}; // evaluation scripts measure first-time costs
  try { return await (await store()).get(keys); } catch { return {}; }
}
export async function remember(entries) {
  if (process.env.CACHE_HOURS === "0" || !entries.length) return;
  try { await (await store()).put(entries); } catch { /* scoring still works without saving */ }
}
