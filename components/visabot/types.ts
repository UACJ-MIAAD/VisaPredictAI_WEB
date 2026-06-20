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
};

export type Source = {
  n: number; // citation number shown as [n]
  title: string;
  source: string;
  url: string;
  text: string;
};

// chart payload attached to a bot message (rendered below the text)
export type ChartPayload = import("@/lib/visabot/analytics").ChartSpec;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  extractive?: boolean; // answered without the LLM (no key / offline)
  chart?: ChartPayload; // data visualization generated from the panel
};
