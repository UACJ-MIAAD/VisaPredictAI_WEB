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
};

export default nextConfig;
