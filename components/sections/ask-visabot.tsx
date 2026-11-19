"use client";

// Home entry to VisaBot: a single question box. Submitting opens the
// assistant with the question already sent (?q=), where the answer can carry a
// chart.

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { localePath } from "@/lib/site-map";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";

export function AskVisabot() {
  const { lang } = useLang();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const go = (text: string) => {
    const t = text.trim();
    if (!t) return;
    track("VisaBot Home Ask", { lang });
    router.push(`${localePath("/asistente", lang)}/?q=${encodeURIComponent(t)}`);
  };
  const chips = [tr(lang, "homeAskChip1"), tr(lang, "homeAskChip2"), tr(lang, "homeAskChip3")];

  return (
    <section id="preguntar" className="home-band">
      <div className="home-inner">
        <h2 className="home-h2">{tr(lang, "homeAskTitle")}</h2>
        <p className="home-lead">{tr(lang, "homeAskLead")}</p>
        <form
          className="home-ask"
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
        >
          <label htmlFor="home-ask-input" className="sr-only">
            {tr(lang, "vbPlaceholder")}
          </label>
          <input
            id="home-ask-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr(lang, "homeAskPlaceholder")}
            autoComplete="off"
          />
          <button type="submit" disabled={!q.trim()} aria-label={tr(lang, "vbSend")}>
            <ArrowUp className="h-5 w-5" aria-hidden />
          </button>
        </form>
        <div className="home-chips">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => go(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
