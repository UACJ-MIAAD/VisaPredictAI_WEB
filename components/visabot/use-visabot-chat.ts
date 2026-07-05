"use client";

// Shared VisaBot chat state machine (BB1). Both chat surfaces — the floating
// widget (visabot.tsx) and the /asistente console (assistant-console.tsx) —
// compose this hook; only their UI shells and legitimate divergences remain
// in the components:
//   • surface "console" attaches a data chart to answers via `prepare` and
//     tracks events with a `surface` prop; the widget NEVER builds charts
//     (invariant of the Claude proxy: the widget prompt says no charts).
//   • widget aborts with vbNoIndex when retrieval fails (it has nothing else
//     to answer from); the console continues (a chart can still ground it).
import * as React from "react";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import {
  retrieve,
  generate,
  warmUp,
  warmUpSemantic,
  isModelReady,
  isSemanticStarted,
} from "./engine";
import type { ChatMessage, ChartPayload, Lang, Source } from "./types";

export type Surface = "widget" | "console";

// localStorage flag: the user already consented to the ~150 MB semantic
// download once — don't re-ask on later visits (AZ1).
const SEMANTIC_OK_KEY = "vb-semantic-ok";

type NetInfo = { saveData?: boolean; effectiveType?: string };

// Data-saver mode or a 2g-class connection → never auto-start the ~150 MB
// download, even with stored consent; only the explicit manual button.
export function isConstrainedConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as Navigator & { connection?: NetInfo }).connection;
  if (!c) return false;
  return c.saveData === true || /(^|-)2g$/.test(c.effectiveType || "");
}

export function useVisabotChat({
  lang,
  surface,
  prepare,
}: {
  lang: Lang;
  surface: Surface;
  /** console-only hook point: builds the chart for the (follow-up-augmented)
   *  query and prepends its synthetic grounding sources. */
  prepare?: (rq: string, sources: Source[]) => { sources: Source[]; chart?: ChartPayload };
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  // semantic engine: consent/download started + model ready (AZ1)
  const [semantic, setSemantic] = React.useState(false);
  const [modelReady, setModelReady] = React.useState(false);
  const [constrained, setConstrained] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  // pick up engine state from a previous mount in the same page load (the
  // module-level engine survives widget close/reopen) + sniff the connection.
  React.useEffect(() => {
    setConstrained(isConstrainedConnection());
    if (isSemanticStarted()) setSemantic(true);
    if (isModelReady()) setModelReady(true);
  }, []);

  const enableSemantic = React.useCallback((persist = true) => {
    if (persist) {
      try {
        localStorage.setItem(SEMANTIC_OK_KEY, "1");
      } catch {
        /* private mode */
      }
    }
    warmUpSemantic();
    setSemantic(true);
  }, []);

  // call when the surface becomes visible: BM25 index always; the semantic
  // engine only resumes automatically with stored consent AND a healthy
  // connection (saveData / 2g users must re-click, AZ1).
  const warm = React.useCallback(() => {
    warmUp();
    let ok = false;
    try {
      ok = localStorage.getItem(SEMANTIC_OK_KEY) === "1";
    } catch {
      /* private mode */
    }
    if (ok && !isConstrainedConnection()) enableSemantic(false);
  }, [enableSemantic]);

  // poll model readiness for the status pill while the download runs
  React.useEffect(() => {
    if (!semantic || modelReady) return;
    const iv = setInterval(() => {
      if (isModelReady()) {
        setModelReady(true);
        clearInterval(iv);
      }
    }, 600);
    return () => clearInterval(iv);
  }, [semantic, modelReady]);

  // autoscroll on new content if pinned to bottom
  React.useEffect(() => {
    if (atBottom) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, atBottom]);

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }, []);

  const scrollToBottom = React.useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      setInput("");
      setBusy(true);
      track("VisaBot Query", surface === "console" ? { lang, surface } : { lang });
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);

      // Época 3.1: history-aware retrieval — augment clear follow-ups
      // ("¿y India?") with the previous user turn; fresh questions untouched.
      const isFollowUp =
        /^(¿?\s*y\b|¿?\s*and\b|pero|adem[aá]s|tambi[eé]n|also|but)\b/i.test(q) ||
        q.split(/\s+/).length <= 3;
      const prevUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
      const rq = isFollowUp && prevUser ? `${prevUser} ${q}` : q;

      let sources: Source[] = [];
      try {
        sources = await retrieve(rq, lang, 6);
      } catch {
        if (surface === "widget") {
          // widget: no chart grounding — without the index there is nothing
          // to answer from, so fail honestly instead of hallucinating.
          setMessages((m) => {
            const c = [...m];
            c[c.length - 1] = { role: "assistant", content: tr(lang, "vbNoIndex") };
            return c;
          });
          setBusy(false);
          return;
        }
        /* console: conversational — a chart can still ground the answer */
      }

      // console-only: build the chart + synthetic grounding sources from the
      // follow-up-augmented query (rq), so "FAD" after "zoom india F1" still
      // resolves country+category+intent.
      let chart: ChartPayload | undefined;
      if (prepare) {
        const p = prepare(rq, sources);
        sources = p.sources;
        chart = p.chart;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await generate(
          q,
          history,
          sources,
          lang,
          (delta) =>
            setMessages((m) => {
              const c = [...m];
              const last = c[c.length - 1];
              c[c.length - 1] = { ...last, content: last.content + delta };
              return c;
            }),
          ctrl.signal,
          surface,
        );
        setMessages((m) => {
          const c = [...m];
          c[c.length - 1] = {
            role: "assistant",
            content: res.text,
            sources,
            extractive: res.extractive,
            chart,
          };
          return c;
        });
        if (res.extractive)
          track("VisaBot Fallback", surface === "console" ? { lang, surface } : { lang });
      } catch {
        setMessages((m) => {
          const c = [...m];
          const last = c[c.length - 1];
          c[c.length - 1] = { ...last, content: last.content || tr(lang, "vbError"), chart };
          return c;
        });
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, lang, messages, surface, prepare],
  );

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }, []);

  const newChat = React.useCallback(() => {
    stop();
    setMessages([]);
    inputRef.current?.focus();
  }, [stop]);

  const copy = React.useCallback((i: number, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(i);
    setTimeout(() => setCopiedId((c) => (c === i ? null : c)), 1600);
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    busy,
    send,
    stop,
    newChat,
    copy,
    copiedId,
    atBottom,
    setAtBottom,
    onScroll,
    scrollToBottom,
    scrollRef,
    inputRef,
    warm,
    semantic,
    modelReady,
    constrained,
    enableSemantic,
  };
}
