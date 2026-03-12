import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate-render": [
      "./scripts/**/*",
      "./generator/**/*",
      // Include ALL of node_modules so the inline pipeline can resolve
      // any transitive dependency at runtime via eval("require").
      // The Vercel function bundler will only deploy the traced subset.
      "./node_modules/**/*",
    ],
    "/api/generate-render/test": [
      "./generator/**/*",
      "./node_modules/**/*",
    ],
  },
};

export default nextConfig;
