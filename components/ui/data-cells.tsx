import { statusColor, movementColor } from "@/lib/data/visa-panel";

// Shared cell renderers for the bulletin feed + panel table (was duplicated ×3).

export function StatusChip({ s }: { s: string }) {
  const color = statusColor(s);
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[0.7rem] font-bold"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {s}
    </span>
  );
}

export function Movement({ d }: { d: number | null }) {
  if (d == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="tabular-nums" style={{ color: movementColor(d) }}>
      {d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "= 0"}
    </span>
  );
}
