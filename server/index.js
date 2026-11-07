// API server. No dependencies: uses Node's built-in http module.
import { createServer } from "node:http";
import { usage } from "./llm.js";
import { intake } from "./agents/intake.js";
import { gap } from "./agents/gap.js";
import { importResume } from "./agents/import.js";
import { profileChat } from "./agents/orchestrator.js";

const PORT = process.env.PORT || 3001;

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

const routes = {
  "GET /api/health": async () => ({ ok: true }),
  "GET /api/usage": async () => usage,
  "POST /api/intake": async (req) => intake(await readJson(req)),
  "POST /api/gap": async (req) => gap(await readJson(req)),
  "POST /api/import": async (req) => importResume(await readJson(req)),
  "POST /api/profile-chat": async (req) => profileChat(await readJson(req)),
};

createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  const handler = routes[`${req.method} ${req.url.split("?")[0]}`];
  if (!handler) return send(res, 404, { error: "Not found" });
  try {
    send(res, 200, await handler(req));
  } catch (err) {
    send(res, 500, { error: err.message });
  }
}).listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
