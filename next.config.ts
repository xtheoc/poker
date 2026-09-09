import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Keep pdf.js out of the server bundle.
   *
   * It resolves its own worker by a path relative to its own file. Bundled into
   * a Turbopack chunk, that path points at a chunk directory the worker was
   * never copied into, and every import dies with "Setting up fake worker
   * failed: Cannot find module …/chunks/pdf.worker.mjs".
   *
   * Left external, it is `require`d out of node_modules at runtime and finds
   * its own files exactly where it expects them. This affects the server only —
   * the browser still bundles pdf.js normally to render pages.
   */
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
