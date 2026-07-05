/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static: all data is fetched client-side, so we export plain HTML and
  // deploy to Netlify/Firebase exactly like the original static site — no server.
  output: "export",
  trailingSlash: true, // emit route/index.html — portable on any static host
  images: { unoptimized: true },
  reactStrictMode: true,
  // a stray ~/package-lock.json confuses root inference; pin it here.
  outputFileTracingRoot: import.meta.dirname,
  webpack: (config) => {
    // AZ2 — onnxruntime-web ships a first-class resolve condition for bundlers:
    // with "onnxruntime-web-use-extern-wasm" its export map resolves to the
    // extern-wasm builds (ort.webgpu.min.mjs) instead of the bundle builds
    // (ort.webgpu.bundle.min.mjs). The bundle build references
    // ort-wasm-simd-threaded.asyncify.wasm via `new URL(..., import.meta.url)`,
    // which webpack emits as a dead ~23 MB asset in .next/static/media — dead
    // because engine.ts sets env.wasm.wasmPaths = "/ort/" and the runtime
    // fetches from there. The extern build loads both the loader .mjs and the
    // .wasm from wasmPaths at runtime (its dynamic import is webpackIgnore'd),
    // so no wasm asset lands in the bundle. "..." keeps webpack's defaults.
    config.resolve.conditionNames = ["onnxruntime-web-use-extern-wasm", "..."];
    return config;
  },
};

export default nextConfig;
