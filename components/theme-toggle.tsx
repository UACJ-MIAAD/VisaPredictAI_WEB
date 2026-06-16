"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-secondary"
      onClick={() => setTheme(isDark ? "light" : "dark")}
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
