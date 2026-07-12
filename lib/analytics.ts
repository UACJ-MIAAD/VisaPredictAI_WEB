// Thin wrapper over Plausible custom events. Safe to call anywhere — if the
// script hasn't loaded yet, the stub in app/layout.tsx queues the call.
declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}

// US I5 — privacy scrub, enforced at the single choke point every event goes
// through: analytics carry AGGREGATE metadata only (labels, buckets, counts,
// booleans), never the user's words. Defense-in-depth over the call sites
// (which already send no query text, pinned by tests/observability.test.ts):
//   • free-text-shaped keys are DROPPED, so a future call site cannot leak a
//     raw query/prompt/answer by mistake;
//   • long string values are truncated (labels and reasons are short; anything
//     longer is not a label).
// See docs/PRIVACY_RAG.md for the full record of what is (not) collected.
const DENY_KEYS = /^(q|query|text|content|message|prompt|input|question|answer)$/i;
const MAX_PROP_CHARS = 120;

export function sanitizeProps(
  props: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (DENY_KEYS.test(k)) continue;
    out[k] = typeof v === "string" && v.length > MAX_PROP_CHARS ? v.slice(0, MAX_PROP_CHARS) : v;
  }
  return out;
}

export function track(
  event: string,
  props?: Record<string, string | number | boolean>,
) {
  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    const clean = props ? sanitizeProps(props) : undefined;
    window.plausible(event, clean && Object.keys(clean).length ? { props: clean } : undefined);
  }
}
