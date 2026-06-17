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

export function track(
  event: string,
  props?: Record<string, string | number | boolean>,
) {
  if (typeof window !== "undefined" && typeof window.plausible === "function") {
    window.plausible(event, props ? { props } : undefined);
  }
}
