import { pipeline } from "@huggingface/transformers";

let _embed;

async function getEmbedder() {
  _embed ??= await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return _embed;
}

export async function vector(text) {
  const embed = await getEmbedder();
  const out = await embed(text, { pooling: "mean", normalize: true });
  return Array.from(out.data);
}

export function cosine(a, b) {
  return a.reduce((s, x, i) => s + x * b[i], 0);
}
