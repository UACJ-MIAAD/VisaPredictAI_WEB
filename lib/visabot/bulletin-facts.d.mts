export function bulletinFactText(
  rows: { country: string; category: string; table: string; raw_value?: string | null; delta_days?: number | null }[],
  monthLabel: string,
  lang: "es" | "en",
  countryName: (c: string) => string,
): string;
