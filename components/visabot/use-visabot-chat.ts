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
  downloadProgress,
} from "./engine";
import type { ChatMessage, ChartPayload, Lang, Source, SyntheticDescriptor } from "./types";

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
   *  query, prepends its synthetic grounding sources (display + extractive
   *  fallback only) and returns the structured descriptors the server rebuilds
   *  the grounding text from (US I1, #30). */
  prepare?: (rq: string, sources: Source[]) => { sources: Source[]; chart?: ChartPayload; synthetics?: SyntheticDescriptor[] };
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [atBottom, setAtBottom] = React.useState(true);
  // semantic engine: consent/download started + model ready (AZ1)
  const [semantic, setSemantic] = React.useState(false);
  const [modelReady, setModelReady] = React.useState(false);
  const [dlProgress, setDlProgress] = React.useState(0);
  const [constrained, setConstrained] = React.useState(false);
  // visually-hidden aria-live status ("thinking", "answer ready", "copied") so
  // screen readers get discrete announcements instead of the streamed answer
  // re-announcing on every token (P4).
  const [liveStatus, setLiveStatus] = React.useState("");

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  // Active-send token. Every send bumps it; async stream continuations check
  // they still own it before mutating messages, so a new-chat / stop / rapid
  // resend during a live stream can't clobber a cleared or shifted array
  // (finding 8: `messages[last]` on an emptied array threw a TypeError).
  const seqRef = React.useRef(0);

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
      setDlProgress(downloadProgress());
      if (isModelReady()) {
        setDlProgress(100);
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

  // Reset the auto-grown textarea back to one row once it is cleared (after
  // send): the height was set imperatively in onInput and otherwise stays tall
  // while empty (finding 20). Covers both surfaces (they share this inputRef).
  React.useEffect(() => {
    if (input === "" && inputRef.current) inputRef.current.style.height = "auto";
  }, [input]);

  const onScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  }, []);

  const scrollToBottom = React.useCallback(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, []);

  const send = React.useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || busy) return;
      const mySeq = ++seqRef.current; // claim this turn
      const alive = () => seqRef.current === mySeq; // still the active turn?
      setInput("");
      setBusy(true);
      setLiveStatus(tr(lang, "vbThinking"));
      track("VisaBot Query", surface === "console" ? { lang, surface } : { lang });
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);

      // Época 3.1: history-aware retrieval — augment CLEAR follow-ups with the
      // previous user turn: a leading continuation connector ("y…"/"and…") OR a
      // 1–2 word fragment that is NOT itself a standalone question. Short direct
      // questions ("¿qué es FAD?", "what is DFF?") are left untouched so their
      // retrieval isn't polluted by the previous topic (finding 9).
      const wc = q.split(/\s+/).length;
      const isFollowUp =
        /^(¿?\s*y\b|¿?\s*and\b|pero|adem[aá]s|tambi[eé]n|also|but)\b/i.test(q) ||
        (wc <= 2 && !/\?|qu[eé]|cu[aá]|c[oó]mo|what|how|which|why|when/i.test(q));
      const prevUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
      const rq = isFollowUp && prevUser ? `${prevUser} ${q}` : q;

      let sources: Source[] = [];
      try {
        sources = await retrieve(rq, lang, 6);
      } catch {
        if (surface === "widget") {
          // widget: no chart grounding — without the index there is nothing
          // to answer from, so fail honestly instead of hallucinating.
          if (alive()) {
            setMessages((m) => {
              if (!alive()) return m;
              const c = [...m];
              c[c.length - 1] = { role: "assistant", content: tr(lang, "vbNoIndex") };
              return c;
            });
            setBusy(false);
            abortRef.current = null;
            setLiveStatus(tr(lang, "vbNoIndex"));
          }
          return;
        }
        /* console: conversational — a chart can still ground the answer */
      }

      // console-only: build the chart + synthetic grounding sources from the
      // follow-up-augmented query (rq), so "FAD" after "zoom india F1" still
      // resolves country+category+intent.
      let chart: ChartPayload | undefined;
      let synthetics: SyntheticDescriptor[] | undefined;
      if (prepare) {
        const p = prepare(rq, sources);
        sources = p.sources;
        chart = p.chart;
        synthetics = p.synthetics;
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
              if (!alive()) return m; // a newer turn / stop / new-chat superseded this stream
              const c = [...m];
              const last = c[c.length - 1];
              if (!last || last.role !== "assistant") return m;
              c[c.length - 1] = { ...last, content: last.content + delta };
              return c;
            }),
          ctrl.signal,
          surface,
          synthetics,
        );
        // US I1: the server returns the synthetic sources it ACTUALLY rebuilt
        // and grounded the LLM with ({t:"sources"} frame) — swap them over the
        // locally-built ones (match by n, keep the local deep-link url) so the
        // displayed citation always equals the served grounding.
        if (res.serverSources?.length) {
          sources = sources.map((s) => {
            if (!s.synthetic) return s;
            const sv = res.serverSources!.find((x) => x.n === s.n);
            return sv ? { ...s, title: sv.title, source: sv.source, text: sv.text } : s;
          });
        }
        setMessages((m) => {
          if (!alive()) return m;
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
        if (alive()) setLiveStatus(tr(lang, "vbReady"));
        if (res.extractive)
          track("VisaBot Fallback", surface === "console" ? { lang, surface } : { lang });
      } catch {
        setMessages((m) => {
          if (!alive()) return m;
          const c = [...m];
          const last = c[c.length - 1];
          if (!last) return m;
          c[c.length - 1] = { ...last, content: last.content || tr(lang, "vbError"), chart };
          return c;
        });
        if (alive()) setLiveStatus(tr(lang, "vbError")); // don't leave SR announcing "thinking…"
      } finally {
        if (alive()) {
          setBusy(false);
          abortRef.current = null;
        }
      }
    },
    [busy, lang, messages, surface, prepare],
  );

  const stop = React.useCallback(() => {
    seqRef.current++; // invalidate the in-flight stream's continuations
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setLiveStatus("");
    // If stopped before any token arrived, remove the empty assistant
    // placeholder — the seq guard now prevents the finalizers from ever filling
    // it, so otherwise the "thinking…" spinner would hang forever (audit).
    setMessages((m) => (m.length && m[m.length - 1].role === "assistant" && !m[m.length - 1].content ? m.slice(0, -1) : m));
  }, []);

  const newChat = React.useCallback(() => {
    stop();
    setMessages([]);
    inputRef.current?.focus();
  }, [stop]);

  const copy = React.useCallback(
    (i: number, text: string) => {
      navigator.clipboard?.writeText(text);
      setCopiedId(i);
      setLiveStatus(tr(lang, "vbCopied"));
      setTimeout(() => setCopiedId((c) => (c === i ? null : c)), 1600);
    },
    [lang],
  );

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
    dlProgress,
    constrained,
    enableSemantic,
    liveStatus,
  };
}
