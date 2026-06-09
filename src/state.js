// src/state.js
// The pipeline's data contract (DESIGN §4). Two parts:
//   1. JSDoc typedefs — documentation/editor hints for the shapes that flow through the graph.
//   2. A Zod schema — a RUNTIME check used to validate the JSON the LLM produces.
import { z } from "zod";

/**
 * @typedef {Object} Preferences
 * @property {string[]} topics       // interests to match against (must have >=1)
 * @property {string[]} keywords     // optional extra match terms
 * @property {string[]} exclusions   // hard "never include" terms
 *
 * @typedef {Object} Article
 * @property {string}  title
 * @property {string}  url
 * @property {string}  summary        // raw summary from the feed
 * @property {string}  source         // feed name, e.g. "Hacker News"
 * @property {string}  publishedDate
 * @property {number[]=} vec          // embedding (added by scoring stage)
 * @property {string=}  label         // winning interest (added by scoring stage)
 * @property {number=}  score         // relevance score (added by scoring stage)
 * @property {string=}  aiSummary     // 2-3 sentence summary (added by summariser)
 *
 * @typedef {Object} PipelineState
 * @property {string}        rawInput      // the user's preference string
 * @property {Preferences=}  preferences   // set by preference agent
 * @property {Article[]}     articles      // grown/filtered by each stage
 * @property {string=}       newsletter    // final Markdown, set by editor
 */

// Validates the preference agent's LLM output. JSDoc above is compile-time-only; THIS runs.
// .parse(obj) throws if the shape is wrong — that's what drives the preference agent's retry.
export const PreferencesSchema = z.object({
  topics:     z.array(z.string()).min(1),  // at least one topic, else the parse is useless
  keywords:   z.array(z.string()),          // may be empty
  exclusions: z.array(z.string()),          // may be empty
});
