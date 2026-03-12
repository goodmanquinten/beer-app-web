import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate-render": [
      "./scripts/**/*",
      "./generator/**/*",
    ],
  },
};

export default nextConfig;
