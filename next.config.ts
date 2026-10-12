import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is a fully authenticated, per-request application: every page depends
  // on the viewer's session, so static shells/cache components add nothing.
  cacheComponents: false,
  partialPrefetching: false,
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
