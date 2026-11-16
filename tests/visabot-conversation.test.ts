import { describe, expect, it } from "vitest";
import { resolveConversationQuery } from "@/lib/visabot/conversation";
import { detectEntities, mergeFollowUp } from "@/lib/visabot/analytics";
import { buildPanel } from "@/lib/data/panel-core";
import { PANEL_CSV } from "./fixtures";
const panel = buildPanel(PANEL_CSV);

describe("conversation retrieval follows the whole chain", () => {
  it.each(["Gracias", "Perfecto", "Thank you", "radar", "heatmap"])("%s starts a fresh intent instead of repeating a forecast", q => {
    expect(resolveConversationQuery(q, ["Pronóstico México F3 FAD"], mergeFollowUp)).toBe(q);
  });
  it.each([
    ["Pronóstico de México F2A FAD", "¿y India?", "¿y DFF?"],
    ["Mexico F2A FAD forecast", "and India?", "and DFF?"],
  ])("retains country and category through three turns: %s", (first, second, third) => {
    const q = resolveConversationQuery(third, [first, second], mergeFollowUp);
    expect(detectEntities(q, panel)).toMatchObject({country: "india", category: "F2A", table: "DFF"});
  });
  it("resets entities when a standalone question starts another topic", () => {
    expect(resolveConversationQuery("What is DFF?", ["Mexico F2A FAD forecast", "and India?"], mergeFollowUp)).toBe("What is DFF?");
  });
  it("can replace a category after changing country and table", () => {
    const q = resolveConversationQuery("¿y F1?", ["Pronóstico México F2A FAD", "¿y India?", "¿y DFF?"], mergeFollowUp);
    expect(detectEntities(q, panel)).toMatchObject({country: "india", category: "F1", table: "DFF"});
  });
});
