// src/index.js — entry point (DESIGN §1).
// Loads .env FIRST so the OpenAI client (constructed when llm.js is imported) sees the key.
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { app } from "./graph.js";

// Read the preference string from the command line (join args so quotes are optional).
const rawInput = process.argv.slice(2).join(" ").trim();
if (!rawInput) {
  console.error('Usage: node src/index.js "I want AI news and open-source tooling, nothing about crypto"');
  process.exit(1);
}

// Run the whole graph. Initial state matches the Annotation channels (DESIGN §4).
const finalState = await app.invoke({ rawInput, articles: [] });

// Write the Markdown to ./output/newsletter-<timestamp>.md and also print it.
await mkdir("output", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-"); // filesystem-safe timestamp
const path = `output/newsletter-${stamp}.md`;
await writeFile(path, finalState.newsletter, "utf8");

console.log(finalState.newsletter);     // stdout = the newsletter itself
console.error(`\n[saved] ${path}`);     // stderr = the status line (keeps stdout clean)
