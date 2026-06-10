// src/core/newsletter.js
// Pure presentation: group articles by topic and render the Markdown. No LLM, no clock
// (date is passed in), so the layout is deterministic and unit-testable. The editor agent
// supplies the intro it gets from the one LLM call.

/** Group articles into a Map keyed by topic label, preserving first-seen order. */
export function groupByLabel(articles) {
  const groups = new Map();
  for (const a of articles) {
    if (!groups.has(a.label)) groups.set(a.label, []);
    groups.get(a.label).push(a);
  }
  return groups;
}

/**
 * Assemble the newsletter Markdown: title, date, intro, then one `##` section per label,
 * each article a linked headline + source + grounded summary. Returns the full document.
 */
export function renderMarkdown({ groups, intro, date }) {
  const lines = [`# Your Personalized Newsletter`, `_${date}_`, ``, intro, ``];

  for (const [label, arts] of groups) {
    lines.push(`## ${label}`, ``);
    for (const a of arts) {
      lines.push(`### [${a.title}](${a.url})`);
      lines.push(`*${a.source}*`, ``);
      lines.push(a.aiSummary, ``);
    }
  }

  return lines.join("\n").trim() + "\n";
}
