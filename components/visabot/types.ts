// Shared VisaBot types.
export type Lang = "es" | "en";

export type Chunk = {
  id: string;
  lang: Lang;
  source: string; // human-readable source (section / doc)
  sourceId: string; // section id for deep-linking
  url: string; // deep link to the source in the site
  title: string;
  text: string;
  kind: "academic" | "glossary" | "reference" | "docs" | "data" | "fact";
  embedCtx?: string; // structural context prefixed before embedding/BM25 (Contextual Retrieval)
};

export type Source = {
  n: number; // citation number shown as [n]
  title: string;
  source: string;
  url: string;
  text: string;
  // US I1 (#30): true for the console's locally-built synthetic grounding
  // sources (month table / bulletin diff / chart notes). They are DISPLAY +
  // extractive-fallback only: engine.generate strips them from the POSTed
  // context and sends a structured descriptor instead — the proxy rebuilds the
  // text server-side from hash-verified release data.
  synthetic?: boolean;
  // User-facing summary of a synthetic source (same facts, no LLM orders) —
  // what the extractive fallback prints instead of `text`.
  display?: string;
};

// US I1 (#30): structured descriptor of a synthetic grounding source. The ONLY
// thing the client tells the server about its rendered chart — identifiers and
// months, never prose, never figures. `release_id` pins the descriptor to the
// release cut this build serves (SITE_STATS.releaseId); a mismatch means a
// stale page against a newer function and 400s as `release_stale`.
export type SyntheticDescriptor =
  | { kind: "month_table"; month: string; table: string; release_id: string }
  | { kind: "bulletin_diff"; monthA: string; monthB: string; table: string; release_id: string }
  | { kind: "forecast_note"; country: string; category: string; table: string; horizon?: number; release_id: string }
  | { kind: "series_compare"; countries: string[]; category: string; table: string; release_id: string }
  | {
      kind: "chart_note";
      chart: "line" | "compare" | "movement" | "status" | "multiline" | "heatmap" | "radar";
      country?: string;
      category?: string;
      table?: string;
      block?: string;
      release_id: string;
    };

// Server-rebuilt synthetic source returned in the first SSE frame ({t:"sources"}).
export type ServerSource = { n: number; title: string; source: string; text: string; url?: string };

// Chart the agent asked the console to display (show_chart / check_priority_date
// on the server). Identifiers only; the console builds the chart itself from
// the same release data with the shared builders.
export type AgentChart = {
  kind: "forecast" | "history" | "movement" | "compare_countries" | "bulletin_table" | "bulletin_diff" | "priority_check";
  country?: string; category?: string; table?: string; countries?: string[];
  month?: string; month_b?: string; priority_date?: string;
  /** priority_check: the server's verified outcome; the console drops its card when its own data disagrees */
  result?: string; cutoff?: string | null;
};

// chart payload attached to a bot message (rendered below the text)
export type ChartPayload = import("@/lib/visabot/analytics").ChartSpec;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  extractive?: boolean; // answered without the LLM (no key / offline)
  chart?: ChartPayload; // data visualization generated from the panel
  // second visual under the first: when the agent's priority-date card takes
  // `chart`, the series chart (guessed from the wording or the forecast) stays here
  extraChart?: ChartPayload;
  // US I5: the answer was cut before completion — by the user's stop button
  // (client abort) or by a server timeout (chat.mjs idle/total truncation).
  incomplete?: boolean;
  // progress line while the agent is consulting data ("Leyendo el pronóstico…")
  status?: string;
};
