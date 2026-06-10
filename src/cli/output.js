// src/cli/output.js
// CLI output adapter: persist a finished newsletter to disk. Separate from index.js
// (orchestration) and the editor (which only produces the string).
import { writeFile, mkdir } from "node:fs/promises";

const OUTPUT_DIR = "output";

/** Write the Markdown to output/newsletter-<timestamp>.md and return the path. */
export async function saveNewsletter(markdown) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-"); // filesystem-safe timestamp
  const path = `${OUTPUT_DIR}/newsletter-${stamp}.md`;
  await writeFile(path, markdown, "utf8");
  return path;
}
