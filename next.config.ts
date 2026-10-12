import type { NextConfig } from "next";

// Deploy under a sub-path (e.g. https://example.com/dataroom) by setting
// BASE_PATH=/dataroom at build time. Leave it empty to serve from the root.
const basePath = (process.env.BASE_PATH || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  // This is a fully authenticated, per-request application: every page depends
  // on the viewer's session, so static shells/cache components add nothing.
  cacheComponents: false,
  partialPrefetching: false,
  basePath: basePath || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  serverExternalPackages: ["@prisma/client", "prisma", "pdf-lib", "nodemailer"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
