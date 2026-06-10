// src/core/math.js
// Pure vector math — lives in core/ (not lib/embeddings.js) so scoring and its tests can
// use cosine without importing @huggingface/transformers.

/** Cosine similarity. Our embeddings are L2-normalised, so this is just the dot product. */
export function cosine(a, b) {
  return a.reduce((s, x, i) => s + x * b[i], 0);
}
