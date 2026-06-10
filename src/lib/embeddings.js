// src/lib/embeddings.js
// The model-backed side of embeddings: turn text into a normalised vector. The pure math
// (cosine) lives in core/math.js so it can be used and tested without loading the model.
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
