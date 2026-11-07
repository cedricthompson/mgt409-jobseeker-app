// Quick test that PORTKEY_API_KEY works: npm run check
import { chat } from "./llm.js";

try {
  const { text, usage } = await chat([{ role: "user", content: "Reply with exactly: key works" }]);
  console.log("Model replied:", text);
  console.log("Tokens used:", usage);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
