// Standalone Node script to run the render pipeline
// Called from the API route via child_process to avoid Turbopack bundling issues
const path = require("path");
const fs = require("fs");

const [, , beerId, inputPath, outputDir, containerType, providerName] = process.argv;

// Suppress pipeline's console.log — redirect to stderr so stdout stays clean
const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

async function main() {
  // Use the local generator/ copy bundled in the project
  const genPkgDir = path.resolve(__dirname, "..", "generator");
  const pipeline = require(path.join(genPkgDir, "dist", "pipeline.js"));
  const providerMod = require(path.join(genPkgDir, "dist", "provider", "index.js"));

  const provider = providerMod.createProvider(providerName || "openai");

  const result = await pipeline.runPipeline({
    inputPath,
    containerType: containerType || "can",
    outputDir,
    styleVersion: "v1",
    providers: [provider],
  });

  // Find best render
  const outputs = result.providerOutputs;
  const best = outputs.find((o) => o.render_png && o.validation.passed)
    || outputs.find((o) => o.render_png);

  if (!best) {
    origLog(JSON.stringify({ error: "No render produced" }));
    process.exit(1);
  }

  // Copy to public/renders/
  const publicPath = path.resolve(__dirname, "..", "public", "renders", `${beerId}.png`);
  fs.copyFileSync(best.render_png, publicPath);

  // Trim transparent padding so the can fills the image
  try {
    const sharp = require("sharp");
    const trimmed = await sharp(publicPath).trim({ threshold: 10 }).toBuffer();
    const margin = 20; // small breathing room
    const extended = await sharp(trimmed)
      .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(publicPath, extended);
  } catch (trimErr) {
    process.stderr.write("Trim warning: " + trimErr.message + "\n");
  }

  origLog(JSON.stringify({ renderUrl: `/renders/${beerId}.png` }));
}

main().catch((err) => {
  origLog(JSON.stringify({ error: err.message }));
  process.exit(1);
});
