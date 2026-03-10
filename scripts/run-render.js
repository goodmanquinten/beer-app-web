// Standalone Node script to run the render pipeline
// Called from the API route via child_process to avoid Turbopack bundling issues
const path = require("path");
const fs = require("fs");

const [, , beerId, inputPath, outputDir, containerType, providerName] = process.argv;

// Suppress pipeline's console.log — redirect to stderr so stdout stays clean
const origLog = console.log;
console.log = (...args) => process.stderr.write(args.join(" ") + "\n");

async function main() {
  const genPkgDir = path.resolve(__dirname, "..", "..", "generator_playground");
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

  origLog(JSON.stringify({ renderUrl: `/renders/${beerId}.png` }));
}

main().catch((err) => {
  origLog(JSON.stringify({ error: err.message }));
  process.exit(1);
});
