// src/graph.js — StateGraph wiring (DESIGN §8).
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { preferenceNode } from "./agents/preference.js";
import { fetcherNode }    from "./agents/fetcher.js";
import { scoringNode }    from "./agents/scoring.js";
import { summariserNode } from "./agents/summariser.js";
import { editorNode }     from "./agents/editor.js";

// The shared state channels (DESIGN §4). Default reducer = last write wins, which is what
// our linear pipeline wants — each node returns {...state, <its field>}.
const State = Annotation.Root({
  rawInput:    Annotation(),
  preferences: Annotation(),
  articles:    Annotation(),
  newsletter:  Annotation(),
});

// Linear pipeline: preference -> fetcher -> scoring -> summariser -> editor.
export const app = new StateGraph(State)
  .addNode("preference", preferenceNode)
  .addNode("fetcher",    fetcherNode)
  .addNode("scoring",    scoringNode)
  .addNode("summariser", summariserNode)
  .addNode("editor",     editorNode)
  .addEdge(START, "preference")
  .addEdge("preference", "fetcher")
  .addEdge("fetcher",    "scoring")
  .addEdge("scoring",    "summariser")
  .addEdge("summariser", "editor")
  .addEdge("editor", END)
  .compile();
