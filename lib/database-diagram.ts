import { copy, type DiagramCopy } from "@/lib/system-diagrams";

export type DatabaseEntity = {
  id: string;
  kind: "dimension" | "fact" | "provenance";
  purpose: DiagramCopy;
  primaryKey: string[];
  columns: string[];
  x: number;
  y: number;
};

// Published schema.sql + migration 002. These are schema fields, not row counts
// or unpropagated campaign results. parent_code is deliberately NOT a self-FK.
export const DATABASE_ENTITIES: DatabaseEntity[] = [
  { id: "dim_area", kind: "dimension", purpose: copy("Área de carga y grupo residual.", "Chargeability area and residual group."), primaryKey: ["area_id"], columns: ["area_id", "slug", "name", "is_residual_group"], x: 0, y: 0 },
  { id: "dim_category", kind: "dimension", purpose: copy("Categoría, bloque y jerarquía informativa.", "Category, block and descriptive hierarchy."), primaryKey: ["category_id"], columns: ["category_id", "block", "code", "parent_code", "preference_level", "is_subcategory", "ina_basis"], x: 1, y: 0 },
  { id: "dim_table", kind: "dimension", purpose: copy("Tabla FAD o DFF.", "FAD or DFF table."), primaryKey: ["table_id"], columns: ["table_id", "code", "name"], x: 2, y: 0 },
  { id: "dim_category_alias", kind: "dimension", purpose: copy("Etiqueta original y rango de meses observados; no es SCD-2.", "Original label and observed month envelope; not SCD-2."), primaryKey: ["alias_id"], columns: ["alias_id", "category_id", "raw_label", "valid_from", "valid_to", "n_months", "created_at", "updated_at"], x: 3, y: 0 },
  { id: "fact_priority", kind: "fact", purpose: copy("Fecha de prioridad por área, categoría, tabla y mes. Objetivo numérico sólo con estado F.", "Priority date by area, category, table and month. Numeric target only for status F."), primaryKey: ["area_id", "category_id", "table_id", "date_id"], columns: ["area_id", "category_id", "table_id", "date_id", "status", "priority_date", "days_since_base", "raw_value", "etl_run_id", "created_at", "updated_at"], x: 0, y: 1 },
  { id: "dim_date", kind: "dimension", purpose: copy("Mes del boletín y calendario compartido.", "Bulletin month and shared calendar."), primaryKey: ["date_id"], columns: ["date_id", "bulletin_date", "year", "month", "quarter", "us_fiscal_year"], x: 1, y: 1 },
  { id: "dim_status", kind: "dimension", purpose: copy("C: current; F: fecha o número finito; U: unavailable; UNK: desconocido.", "C: current; F: finite date or number; U: unavailable; UNK: unknown."), primaryKey: ["status"], columns: ["status", "label", "description", "is_predictable"], x: 2, y: 1 },
  { id: "dim_region", kind: "dimension", purpose: copy("Región de Diversity Visa.", "Diversity Visa region."), primaryKey: ["region_id"], columns: ["region_id", "slug", "name"], x: 3, y: 1 },
  { id: "etl_run", kind: "provenance", purpose: copy("Identidad, hashes y estado de la construcción. Su relación con hechos se comprueba por código.", "Build identity, hashes and status. Its relationship to facts is checked in code."), primaryKey: ["run_id"], columns: ["run_id", "built_at_utc", "schema_version", "n_fact_priority", "n_fact_dv", "n_trainable_f", "pct_trainable", "panel_floor", "panel_ceiling", "pipeline_run_id", "git_sha", "git_dirty", "panel_sha256", "dvc_lock_sha256", "env_lock_sha256", "started_at", "completed_at", "build_status", "degradations"], x: 0, y: 2 },
  { id: "source_artifact", kind: "provenance", purpose: copy("HTML congelado, SHA-256 y añada; se cruza por valor con el mes del boletín.", "Frozen HTML, SHA-256 and vintage; joined by value to the bulletin month."), primaryKey: ["source_id"], columns: ["source_id", "filename", "url", "license", "sha256", "vintage", "source_modified_at", "created_at", "updated_at"], x: 1, y: 2 },
  { id: "fact_dv_rank", kind: "fact", purpose: copy("Corte de rango DV por región y mes; no se divide en FAD/DFF.", "DV rank cutoff by region and month; not split into FAD/DFF."), primaryKey: ["region_id", "date_id"], columns: ["region_id", "date_id", "status", "rank_cutoff", "raw_value", "exceptions", "etl_run_id", "created_at", "updated_at"], x: 2, y: 2 },
  { id: "schema_version", kind: "provenance", purpose: copy("Migraciones aplicadas y checksum del SQL.", "Applied migrations and SQL checksums."), primaryKey: ["version"], columns: ["version", "description", "applied_at", "checksum"], x: 3, y: 2 },
];

export type DatabaseRelation = {
  from: string; column: string; to: string; target: string;
  kind: "foreign-key" | "asserted" | "by-value";
};
// Direction: child → parent. All links are many-to-one in this direction,
// except vintage → bulletin_date: a month can have multiple source snapshots.
export const DATABASE_RELATIONS: DatabaseRelation[] = [
  { from: "fact_priority", column: "area_id", to: "dim_area", target: "area_id", kind: "foreign-key" },
  { from: "fact_priority", column: "category_id", to: "dim_category", target: "category_id", kind: "foreign-key" },
  { from: "fact_priority", column: "table_id", to: "dim_table", target: "table_id", kind: "foreign-key" },
  { from: "fact_priority", column: "date_id", to: "dim_date", target: "date_id", kind: "foreign-key" },
  { from: "fact_priority", column: "status", to: "dim_status", target: "status", kind: "foreign-key" },
  { from: "dim_category_alias", column: "category_id", to: "dim_category", target: "category_id", kind: "foreign-key" },
  { from: "fact_dv_rank", column: "region_id", to: "dim_region", target: "region_id", kind: "foreign-key" },
  { from: "fact_dv_rank", column: "date_id", to: "dim_date", target: "date_id", kind: "foreign-key" },
  { from: "fact_dv_rank", column: "status", to: "dim_status", target: "status", kind: "foreign-key" },
  { from: "etl_run", column: "schema_version", to: "schema_version", target: "version", kind: "foreign-key" },
  { from: "fact_priority", column: "etl_run_id", to: "etl_run", target: "run_id", kind: "asserted" },
  { from: "fact_dv_rank", column: "etl_run_id", to: "etl_run", target: "run_id", kind: "asserted" },
  { from: "source_artifact", column: "vintage", to: "dim_date", target: "bulletin_date", kind: "by-value" },
];

export const DATABASE_VIEWS = ["v_panel_long", "v_trainable_by_preference", "v_category_alias", "v_dv_long", "mart_training_F", "mart_series_summary"];
