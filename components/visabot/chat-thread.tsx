"use client";

// Shared message-thread rendering for both VisaBot surfaces (BB1): user/bot
// bubbles, thinking spinner, extractive note, cited-source chips and message
// actions. Legitimate divergences are driven by props:
//   • variant "console" adds the min-w-0/overflow classes its wide layout
//     needs (the widget keeps its original compact classes untouched);
//   • renderChart — console only (the widget never renders charts: invariant
//     of the Claude proxy / surface prompt);
//   • onSpeak — widget only (read-aloud action).
import * as React from "react";
import { Check, Copy, Loader2, Volume2 } from "lucide-react";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { Markdown } from "./markdown";
import type { ChatMessage, ChartPayload, Lang } from "./types";

export function ChatThread({
  lang,
  variant,
  messages,
  copiedId,
  onCopy,
  onSpeak,
  renderChart,
  followUps,
  onFollowUp,
}: {
  lang: Lang;
  variant: "widget" | "console";
  messages: ChatMessage[];
  copiedId: number | null;
  onCopy: (i: number, text: string) => void;
  onSpeak?: (text: string) => void;
  renderChart?: (chart: ChartPayload) => React.ReactNode;
  /** contextual next-question chips shown under the latest completed answer */
  followUps?: string[];
  onFollowUp?: (q: string) => void;
}) {
  const wide = variant === "console";
  return (
    <>
      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="flex justify-end">
            <div className="vb-bubble vb-user">{m.content}</div>
          </div>
        ) : (
          <div key={i} className={`group/msg space-y-2 ${wide ? "min-w-0" : ""}`}>
            <div className={`vb-bubble vb-bot ${wide ? "min-w-0 max-w-full overflow-hidden" : ""}`}>
              {m.content ? (
                <Markdown text={m.content} sources={m.sources} />
              ) : (
                <span className="flex items-center gap-2 text-[var(--color-muted)]">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {tr(lang, "vbThinking")}
                </span>
              )}
              {m.chart && renderChart ? renderChart(m.chart) : null}
              {m.extractive && m.content && (
                <p className="mt-2 text-[0.68rem] italic text-[var(--color-muted)]">
                  {tr(lang, "vbExtractiveNote")}
                </p>
              )}
            </div>

            {/* sources — only the ones the answer actually cites */}
            {m.sources && m.sources.some((s) => m.content.includes(`[${s.n}]`)) && (
              <div className="flex flex-wrap items-center gap-1.5 pl-1">
                <span className="text-[0.62rem] uppercase tracking-wide text-[var(--color-muted)]">
                  {tr(lang, "vbSources")}:
                </span>
                {m.sources
                  .filter((s) => m.content.includes(`[${s.n}]`))
                  .map((s) => (
                    <a
                      key={s.n}
                      href={s.url}
                      onClick={() => track("VisaBot Source Click", { lang, source: s.source })}
                      className="vb-chip"
                      title={`${s.source}${s.title ? " — " + s.title : ""}`}
                    >
                      [{s.n}] {s.source}
                    </a>
                  ))}
              </div>
            )}

            {/* actions */}
            {m.content && (
              <div className="flex gap-1 pl-1 opacity-0 transition group-hover/msg:opacity-100">
                <button
                  onClick={() => onCopy(i, m.content)}
                  className="vb-iconbtn"
                  aria-label={tr(lang, "vbCopy")}
                  title={tr(lang, "vbCopy")}
                >
                  {copiedId === i ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
                {onSpeak && (
                  <button
                    onClick={() => onSpeak(m.content)}
                    className="vb-iconbtn"
                    aria-label={tr(lang, "vbSpeak")}
                    title={tr(lang, "vbSpeak")}
                  >
                    <Volume2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                )}
              </div>
            )}
          </div>
        ),
      )}

      {/* contextual follow-up chips under the latest answer */}
      {followUps && followUps.length > 0 && onFollowUp && (
        <div className="flex flex-wrap gap-1.5 pl-1 pt-1" aria-label={tr(lang, "vbFollowUps")}>
          {followUps.map((f) => (
            <button key={f} onClick={() => onFollowUp(f)} className="vb-suggest text-[0.76rem]">
              {f}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
