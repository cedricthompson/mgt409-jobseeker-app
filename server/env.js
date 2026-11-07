// Loads .env: the repo folder first, then one folder up (course requirement).
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const p of [resolve(repoRoot, ".env"), resolve(repoRoot, "..", ".env")]) {
  if (existsSync(p)) { process.loadEnvFile(p); break; }
}
