"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { tr } from "@/lib/i18n";
import { track } from "@/lib/analytics";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { lang } = useLang();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label={tr(lang, !mounted ? "toggleTheme" : isDark ? "toLight" : "toDark")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary"
      onClick={() => {
        const next = isDark ? "light" : "dark";
        track("Theme Toggle", { theme: next });
        setTheme(next);
      }}
    >
      {/* render a stable icon until mounted to avoid hydration mismatch */}
      {mounted && isDark ? (
        <Sun className="h-[1.1rem] w-[1.1rem]" aria-hidden />
      ) : (
        <Moon className="h-[1.1rem] w-[1.1rem]" aria-hidden />
      )}
    </button>
  );
}
