// Regression guard for the 2026-07-12 prod incident: the extensionless
// "./panel-core" import in the worker resolved to panel-core.mjs, whose
// surface was missing fetchPanelText -> TypeError -> dead panel everywhere.
// Both resolution targets must expose the complete surface forever.
import { describe, expect, it } from "vitest";
import * as mjs from "../lib/data/panel-core.mjs";
import * as ts from "../lib/data/panel-core";

const SURFACE = ["parseCsv", "computeMovement", "buildPanel", "fetchPanelText", "PANEL_CSV_URL"] as const;

describe("panel-core surface parity (.mjs vs .ts wrapper)", () => {
  it("panel-core.mjs exposes the full surface the worker needs", () => {
    for (const name of SURFACE) expect(mjs, name).toHaveProperty(name);
    expect(typeof (mjs as Record<string, unknown>).fetchPanelText).toBe("function");
  });
  it("the .ts wrapper re-exports the same members", () => {
    for (const name of SURFACE) expect(ts, name).toHaveProperty(name);
  });
});
