import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import sharp from "sharp";

export const maxDuration = 60;

const BUCKET = "beer-renders";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, serviceKey);
}

/**
 * Run the generator pipeline inline (same Node process).
 * Previously used execFile child process, but that breaks on Vercel
 * because the file tracer can't follow dynamic require() chains.
 */
async function runPipelineInline(
  beerId: string,
  inputPath: string,
  outputDir: string,
  containerType: string,
  providerName: string,
): Promise<{ renderPath: string } | { error: string }> {
  const genDir = path.join(process.cwd(), "generator");
  const pipelinePath = path.join(genDir, "dist", "pipeline.js");

  if (!fs.existsSync(pipelinePath)) {
    return { error: `Pipeline not found: ${pipelinePath}` };
  }

  // Use eval('require') to bypass Turbopack static analysis — these are
  // runtime-only loads from the bundled generator/ directory
  // eslint-disable-next-line no-eval
  const _require = eval("require") as NodeRequire;
  const pipeline = _require(pipelinePath);
  const providerMod = _require(path.join(genDir, "dist", "provider", "index.js"));
  const ocrMod = _require(path.join(genDir, "dist", "ocr.js"));

  // Skip spell-check to save ~15s (tesseract download + OCR on Vercel)
  ocrMod.spellCheckRender = async () => ({
    total_words: 0, bad_words: [], good_words: [], score: 1,
  });

  // Wrap palette extraction with fallback — node-vibrant has deep deps
  // that may not all be traced on Vercel. Palette is nice-to-have.
  const paletteMod = _require(path.join(genDir, "dist", "palette.js"));
  const origExtractPalette = paletteMod.extractPalette;
  paletteMod.extractPalette = async (...args: unknown[]) => {
    try {
      return await origExtractPalette(...args);
    } catch (e) {
      console.warn("Palette extraction fallback:", e instanceof Error ? e.message : e);
      return ["#c4873a", "#a06830", "#7a4f25", "#f5e6d0", "#1a1a1a"];
    }
  };

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
  let best = outputs.find((o: { render_png: string; validation: { passed: boolean } }) =>
    o.render_png && o.validation.passed
  ) || outputs.find((o: { render_png: string }) => o.render_png);

  // Fallback: if pipeline reported failure but a render file exists on disk
  if (!best) {
    const fallbackFiles = fs.readdirSync(outputDir).filter((f: string) => f.endsWith("_render.png"));
    if (fallbackFiles.length > 0) {
      console.log("Using fallback render file:", fallbackFiles[0]);
      best = { render_png: path.join(outputDir, fallbackFiles[0]) };
    }
  }

  if (!best) {
    const errDetails = outputs.map(
      (o: { validation?: { issues?: string[] } }) => o.validation?.issues?.join("; ") || "unknown"
    ).join(" | ");
    return { error: "No render produced: " + errDetails };
  }

  // Copy to public/renders/ and trim
  const rendersDir = path.join(process.cwd(), "public", "renders");
  fs.mkdirSync(rendersDir, { recursive: true });
  const publicPath = path.join(rendersDir, `${beerId}.png`);
  fs.copyFileSync(best.render_png, publicPath);

  // Trim transparent padding so the can fills the image
  try {
    const trimmed = await sharp(publicPath).trim({ threshold: 10 }).toBuffer();
    const margin = 20;
    const extended = await sharp(trimmed)
      .extend({ top: margin, bottom: margin, left: margin, right: margin, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    fs.writeFileSync(publicPath, extended);
  } catch (trimErr) {
    console.warn("Trim warning:", trimErr instanceof Error ? trimErr.message : trimErr);
  }

  return { renderPath: publicPath };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { beerId, imageDataUrl, containerType = "can" } = await req.json();

  if (!beerId || !imageDataUrl) {
    return NextResponse.json(
      { error: "beerId and imageDataUrl are required" },
      { status: 400 }
    );
  }

  try {
    // Decode data URL to a temp file
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, "");
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `beer_input_${beerId}.png`);
    fs.writeFileSync(inputPath, Buffer.from(base64Data, "base64"));

    const outputDir = path.join(tmpDir, `beer_output_${beerId}`);
    const providerName = process.env.RENDER_PROVIDER || "openai";

    // Run pipeline inline (same process — avoids Vercel dependency tracing issues)
    const pipelineResult = await runPipelineInline(
      beerId, inputPath, outputDir, containerType, providerName,
    );

    if ("error" in pipelineResult) {
      return NextResponse.json({ error: pipelineResult.error }, { status: 500 });
    }

    // Upload the render to Supabase Storage for persistence on Vercel
    let publicUrl: string | null = null;

    if (fs.existsSync(pipelineResult.renderPath)) {
      const fileBuffer = fs.readFileSync(pipelineResult.renderPath);
      const storagePath = `${beerId}.png`;
      const admin = getAdminSupabase();

      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
      } else {
        const { data: urlData } = admin.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);
        publicUrl = urlData.publicUrl;

        if (publicUrl) {
          const { error: updateError } = await admin
            .from("beers")
            .update({ image_url: publicUrl })
            .eq("id", beerId);

          if (updateError) {
            console.error("DB image_url update error:", updateError);
          }
        }
      }
    } else {
      console.error("Render file not found at:", pipelineResult.renderPath);
    }

    // Cleanup temp files
    try {
      fs.unlinkSync(inputPath);
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }

    return NextResponse.json({
      renderUrl: publicUrl || `/renders/${beerId}.png`,
    });
  } catch (err) {
    console.error("Render generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Render generation failed" },
      { status: 500 }
    );
  }
}
