export type Lang = "es" | "en";
export type ArticleFacts = {
  facts: Record<string, { text: string; value?: number; ci?: number[] }>;
  es?: { title: string; short_title: string; abstract: string; keywords: string[] };
  en?: { title: string; short_title: string; abstract: string; keywords: string[] };
  [k: string]: unknown;
};
export type MethodId = "blend" | "sim" | "rw" | "vel";
export type Estimate = { value: number; text: string; ci: number[]; ciText: string };
export type Point = Estimate & { k: number; n?: string };
export type Horizon = {
  k: number; label: string; n: string; series: string; upper: string;
  methods: Record<MethodId, Estimate>;
  brier: { blend: string; ref: string; sim: string; rw: string; vel: string };
};
export type Example = {
  id: string; name: string; pd: string; cut: string; gap: string; evaluated: boolean;
  blend: { k: number; text: string; value: number }[];
  scenario: { years: number; text: string; value: number }[];
  median: string;
};
export type Para = { tag: string; title: string; paras: string[] };
export type ArticleModel = {
  lang: Lang; title: string; shortTitle: string; abstract: string; keywords: string[];
  authors: { name: string; role: string }[]; affiliation: string;
  stats: { value: string; label: string; sub: string }[];
  methods: { id: MethodId; label: string; desc: string }[];
  horizons: Horizon[];
  long: { k: number; label: string; n: string; series: string; brier: { sim: string; rw: string; vel: string } }[];
  designs: { id: string; label: string; points: Point[] }[];
  subgroups: { id: string; label: string; points: Point[] }[];
  landscape: { gaps: number[]; horizons: number[]; cells: { g: number; k: number; value: number | null; text: string; base: string }[][]; nByHorizon: string[] };
  examples: Example[];
  sections: {
    pregunta: Para; acto1: Para;
    metodos: { tag: string; title: string; lead: string };
    protocolo: { tag: string; title: string; rules: { title: string; text: string }[] };
    resultados: Para & { chartNote: string };
    sensibilidad: { tag: string; title: string; lead: string; subLead: string };
    mapa: { tag: string; title: string; lead: string };
    largo: Para;
    ejemplos: { tag: string; title: string; lead: string; outside: string };
    limites: { tag: string; title: string; items: string[] };
    estado: Para;
  };
  faq: { q: string; a: string }[];
};
export function fx(data: ArticleFacts, name: string): string;
export function fv(data: ArticleFacts, name: string): number;
export function articleModel(data: ArticleFacts, lang: Lang): ArticleModel;
export function articleChunks(data: ArticleFacts): { lang: Lang; anchor: string; title: string; text: string }[];
