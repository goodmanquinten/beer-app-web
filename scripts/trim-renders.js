/**
 * Trim transparent padding from all render PNGs.
 * Keeps a small margin (2% of original) for clean edges.
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const RENDERS_DIR = path.join(__dirname, "..", "public", "renders");
const MARGIN_PERCENT = 0.02; // 2% margin around trimmed content

async function trimImage(filePath) {
  const name = path.basename(filePath);
  try {
    const img = sharp(filePath);
    const meta = await img.metadata();

    // Trim transparent pixels
    const trimmed = await img.trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
    const trimInfo = trimmed.info;

    // Add small margin back
    const margin = Math.round(Math.max(meta.width, meta.height) * MARGIN_PERCENT);
    const extended = await sharp(trimmed.data)
      .extend({
        top: margin,
        bottom: margin,
        left: margin,
        right: margin,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();

    // Get final dimensions
    const finalMeta = await sharp(extended).metadata();

    // Overwrite the file
    fs.writeFileSync(filePath, extended);
    console.log(
      `${name}: ${meta.width}x${meta.height} → ${finalMeta.width}x${finalMeta.height} (trimmed)`
    );
  } catch (err) {
    console.error(`${name}: FAILED - ${err.message}`);
  }
}

async function main() {
  if (!fs.existsSync(RENDERS_DIR)) {
    console.log("No renders directory found.");
    return;
  }

  const files = fs
    .readdirSync(RENDERS_DIR)
    .filter((f) => f.endsWith(".png"))
    .map((f) => path.join(RENDERS_DIR, f));

  if (files.length === 0) {
    console.log("No PNG files found in renders/");
    return;
  }

  console.log(`Trimming ${files.length} render(s)...`);
  for (const file of files) {
    await trimImage(file);
  }
  console.log("Done.");
}

main();
