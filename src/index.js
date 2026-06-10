// src/index.js - Thin CLI: read the preference arg, run the
// graph, save + print. Loads .env first so the key check and the OpenAI client see it.
import "dotenv/config";

const rawInput = process.argv.slice(2).join(" ").trim();
if (!rawInput) {
  console.error('Usage: node src/index.js "I want AI news and open-source tooling, nothing about crypto"');
  process.exit(1);
}

// Guard before importing the graph — graph.js pulls in the OpenAI client, which needs a key.
if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY. Create a .env file in the project root with:\n");
  console.error("  OPENAI_API_KEY=sk-...\n");
  console.error("then re-run. (Get a key at https://platform.openai.com/api-keys)");
  process.exit(1);
}

// Dynamic imports so the guard above runs first.
const { app } = await import("./graph.js");
const { saveNewsletter } = await import("./cli/output.js");

const finalState = await app.invoke({ rawInput, articles: [] });

const path = await saveNewsletter(finalState.newsletter);
console.log(finalState.newsletter);   // stdout = the newsletter
console.error(`\n[saved] ${path}`);   // stderr = status line (keeps stdout clean)
