// Type surface for cohort-facts.mjs (plain ESM so the RAG builder and the verify script can
// import it from Node). Kept in sync BY HAND with the .mjs exports.

export type CohortTable = "FAD" | "DFF";
export type CohortStatus = "exploratorio";

export type CohortFacts = {
  NSeriesEvaluable: number;
  NEstable: number;
  NNoEstable: number;
  RuleVersion: string;
  ScanBate: number;
  CampanaBate: number;
  RouterCeldas: number;
  RouterGana: number;
  RouterPierde: number;
  RouterSinEvidencia: number;
  ScanPeor: number;
  ScanSinDatos: number;
  CampanaLanes: number;
  CampanaOk: number;
  CampanaPrimarias: number;
  byTable: Record<CohortTable, { estable: number; no_estable: number }>;
  status: CohortStatus;
};

export type CohortSurface = {
  eyebrow: string;
  title: string;
  intro: string;
  stats: { value: string; label: string }[];
  tableHead: [string, string, string];
  byTable: { table: CohortTable; stable: number; unstable: number }[];
  findings: string[];
  statusLabel: string;
  status: string;
  statusNote: string;
};

export type CohortChunk = { id: string; lang: "es" | "en"; kind: "fact"; title: string; text: string };

export declare const COHORT_FACT_FIELDS: [keyof CohortFacts, "int" | "string"][];
export declare const COHORT_TABLES: CohortTable[];
export declare const COHORT_STATUS: Record<CohortStatus, { es: string; en: string }>;
export declare function readCohortFacts(raw: unknown): CohortFacts | null;
export declare function cohortSentence(facts: CohortFacts | null, lang?: string): string | null;
export declare function cohortSurface(facts: CohortFacts | null, lang?: string): CohortSurface | null;
export declare function cohortChunks(facts: CohortFacts | null): CohortChunk[];
