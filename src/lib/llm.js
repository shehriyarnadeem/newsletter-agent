// src/lib/llm.js
// One shared OpenAI client + a thin ask() wrapper used by every LLM agent (DESIGN §7).
import OpenAI from "openai";

// Constructed once at import. Reads OPENAI_API_KEY from the environment automatically
// (loaded via `node --env-file=.env` or dotenv). This is the one allowed global (DESIGN §0.6).
const client = new OpenAI();

/**
 * Send a single system+user prompt and return the assistant's text reply.
 * @param {Object}  opts
 * @param {string}  opts.model        e.g. "gpt-5.4-mini"
 * @param {string}  opts.system       instructions / role for the model
 * @param {string}  opts.user         the actual input to act on
 * @param {number} [opts.maxTokens]   cap on the reply length
 * @returns {Promise<string>}         the reply text (message.content)
 */
export async function ask({ model, system, user, maxTokens = 1024 }) {
  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: maxTokens,   // GPT-5.x uses this, NOT the old max_tokens
    messages: [
      { role: "system", content: system },  // who the model is / rules it must follow
      { role: "user",   content: user },     // the data to process
    ],
  });
  return res.choices[0].message.content;     // the model's text answer
}
