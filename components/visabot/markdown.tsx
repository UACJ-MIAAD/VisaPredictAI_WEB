"use client";

import * as React from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { Source } from "./types";

marked.setOptions({ gfm: true, breaks: true });

// Render streamed markdown safely, turning [n] into deep-linked citation chips.
// DOMPurify needs a DOM, so we only sanitize after mount (the server/static
// export and the first client render show plain text → no SSR crash, no
// hydration mismatch); the effect then swaps in the sanitized HTML.
export function Markdown({ text, sources }: { text: string; sources?: Source[] }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const html = React.useMemo(() => {
    if (!mounted) return "";
    let out = marked.parse(text, { async: false }) as string;
    if (sources?.length) {
      const byN = new Map(sources.map((s) => [s.n, s]));
      out = out.replace(/\[(\d+)\]/g, (m, d) => {
        const s = byN.get(Number(d));
        if (!s) return m;
        return `<a href="${s.url}" class="vb-cite" title="${escapeAttr(s.source)}${
          s.title ? " — " + escapeAttr(s.title) : ""
        }">[${d}]</a>`;
      });
    }
    return DOMPurify.sanitize(out, {
      ALLOWED_TAGS: [
        "a", "b", "strong", "i", "em", "p", "br", "ul", "ol", "li", "h1", "h2",
        "h3", "h4", "blockquote", "code", "pre", "table", "thead", "tbody", "tr",
        "th", "td", "hr", "span",
      ],
      ALLOWED_ATTR: ["href", "title", "class", "target", "rel"],
      ADD_ATTR: ["target", "rel"],
    });
  }, [text, sources, mounted]);

  if (!mounted) return <div className="vb-md" style={{ whiteSpace: "pre-wrap" }}>{text}</div>;
  return <div className="vb-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeAttr(s: string) {
  return s.replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
