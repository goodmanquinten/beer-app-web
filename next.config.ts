import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/generate-render": [
      "./scripts/**/*",
      "./generator/**/*",
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
      "./node_modules/node-vibrant/**/*",
      "./node_modules/tesseract.js/**/*",
      "./node_modules/commander/**/*",
      "./node_modules/form-data/**/*",
    ],
  },
};

export default nextConfig;
