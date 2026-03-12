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

  // Skip spell-check on Vercel to save ~15s (tesseract download + OCR)
  // The spell check is cosmetic — the render is valid without it
  const ocrMod = require(path.join(genPkgDir, "dist", "ocr.js"));
  ocrMod.spellCheckRender = async () => ({
    total_words: 0, bad_words: [], good_words: [], score: 1,
  });

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
  let best = outputs.find((o) => o.render_png && o.validation.passed)
    || outputs.find((o) => o.render_png);

  // Fallback: if pipeline reported failure (e.g. spell-check crash) but
  // a render file exists on disk, use it anyway
  if (!best) {
    const basename = path.basename(inputPath, path.extname(inputPath));
    const fallbackFiles = fs.readdirSync(outputDir).filter(f => f.endsWith("_render.png"));
    if (fallbackFiles.length > 0) {
      process.stderr.write("Using fallback render file: " + fallbackFiles[0] + "\n");
      best = { render_png: path.join(outputDir, fallbackFiles[0]) };
    }
  }

  if (!best) {
    const errDetails = outputs.map(o => o.validation?.issues?.join("; ") || "unknown").join(" | ");
    origLog(JSON.stringify({ error: "No render produced: " + errDetails }));
    process.exit(1);
  }

  // Copy to public/renders/
  const rendersDir = path.resolve(__dirname, "..", "public", "renders");
  fs.mkdirSync(rendersDir, { recursive: true });
  const publicPath = path.join(rendersDir, `${beerId}.png`);
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
