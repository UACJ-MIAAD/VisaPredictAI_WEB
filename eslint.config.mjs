import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "next-env.d.ts",

      // F2: runtime ONNX vendorizado (third-party minificado) — excluido EXPLÍCITO;
      // todo lo propio (incl. scripts/) se linta con --max-warnings=0.
      "public/ort/**",
      "content/**",
      "lib/content/sections.generated.ts",
      "index.html",
      "index4.html",
    ],
  },
];

export default config;
