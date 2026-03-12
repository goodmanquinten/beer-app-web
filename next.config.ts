import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-vibrant", "sharp"],
  outputFileTracingIncludes: {
    "/api/generate-render": [
      "./scripts/**/*",
      "./generator/**/*",
      // sharp + native binaries + transitive deps
      "./node_modules/sharp/**/*",
      "./node_modules/@img/**/*",
      "./node_modules/detect-libc/**/*",
      "./node_modules/color/**/*",
      "./node_modules/color-convert/**/*",
      "./node_modules/color-name/**/*",
      "./node_modules/color-string/**/*",
      "./node_modules/simple-swizzle/**/*",
      "./node_modules/semver/**/*",
      // node-vibrant + transitive deps
      "./node_modules/node-vibrant/**/*",
      "./node_modules/lodash/**/*",
      "./node_modules/@jimp/**/*",
      "./node_modules/bmp-js/**/*",
      "./node_modules/gifwrap/**/*",
      "./node_modules/jpeg-js/**/*",
      "./node_modules/pngjs/**/*",
      "./node_modules/utif/**/*",
      "./node_modules/pako/**/*",
      "./node_modules/omggif/**/*",
      // other pipeline deps
      "./node_modules/form-data/**/*",
    ],
  },
};

export default nextConfig;
