// Dependency-free static server for the Playwright suite (US E3). Serves the
// Next.js static export in out/ the way Netlify does: trailingSlash routes
// resolve to route/index.html, unknown paths fall back to 404.html. No
// _headers processing on purpose — CSP is Netlify's concern and would only
// get in the way of test instrumentation (addInitScript).
//
// Usage: node tests/e2e/static-server.mjs [--port 4614]
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../out",
);
const argPort = process.argv.indexOf("--port");
const PORT = argPort > -1 ? Number(process.argv[argPort + 1]) : 4614;

if (!existsSync(path.join(ROOT, "index.html"))) {
  console.error(
    `static-server: ${ROOT}/index.html no existe.\n` +
      "Genera el export primero: npm run build:offline (o npm run test:e2e:build).",
  );
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function send(res, status, filePath) {
  res.writeHead(status, {
    "content-type": MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    res.writeHead(400).end("bad request");
    return;
  }
  // Path-traversal guard: resolve inside ROOT or bust.
  const resolved = path.normalize(path.join(ROOT, pathname));
  if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
    res.writeHead(403).end("forbidden");
    return;
  }

  const candidates = pathname.endsWith("/")
    ? [path.join(resolved, "index.html")]
    : [resolved, path.join(resolved, "index.html"), `${resolved}.html`];
  for (const file of candidates) {
    try {
      if (statSync(file).isFile()) return send(res, 200, file);
    } catch {
      /* try next candidate */
    }
  }
  const notFound = path.join(ROOT, "404.html");
  if (existsSync(notFound)) return send(res, 404, notFound);
  res.writeHead(404).end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`static-server: sirviendo ${ROOT} en http://127.0.0.1:${PORT}`);
});
