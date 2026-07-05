// AZ5 — Web Worker: fetch + parse + movement over the ~1.5 MB panel CSV happen
// OFF the main thread; only the structured-clone of the finished Panel touches
// it. Spawned by loadPanel() in visa-panel.ts via
// `new Worker(new URL("./panel-worker.ts", import.meta.url))` (bundled by Next).
import { buildPanel, fetchPanelText } from "./panel-core";

self.onmessage = async () => {
  try {
    const panel = buildPanel(await fetchPanelText());
    self.postMessage({ ok: true as const, panel });
  } catch (e) {
    self.postMessage({ ok: false as const, error: e instanceof Error ? e.message : String(e) });
  }
};
