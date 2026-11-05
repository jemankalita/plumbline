import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every workspace page reads live review data, so request-time rendering is the right default.
  cacheComponents: false,
  serverExternalPackages: ["mammoth", "unpdf"],
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
