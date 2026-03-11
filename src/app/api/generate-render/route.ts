import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";

export const maxDuration = 60;

const BUCKET = "beer-renders";

function runScript(args: string[], env: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "run-render.js");
    execFile("node", [scriptPath, ...args], {
      env: { ...process.env, ...env },
      timeout: 120000,
    }, (error, stdout, stderr) => {
      if (stderr) console.log("Pipeline log:", stderr.slice(0, 500));
      const output = stdout.trim();
      if (error && !output) {
        reject(new Error(error.message));
      } else if (!output) {
        reject(new Error("No output from render script"));
      } else {
        resolve(output);
      }
    });
  });
}

async function ensureBucket(supabase: ReturnType<typeof createAdminClient>) {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets && !buckets.find((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
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

    // Run pipeline in a separate Node process to avoid Turbopack
    const output = await runScript(
      [beerId, inputPath, outputDir, containerType, providerName],
      { OPENAI_API_KEY: process.env.OPENAI_API_KEY || "" }
    );

    const result = JSON.parse(output);
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Upload the render to Supabase Storage for persistence on Vercel
    const localRenderPath = path.join(process.cwd(), "public", "renders", `${beerId}.png`);
    let publicUrl: string | null = null;

    if (fs.existsSync(localRenderPath)) {
      const fileBuffer = fs.readFileSync(localRenderPath);
      const storagePath = `${beerId}.png`;

      // Ensure bucket exists
      await ensureBucket(supabase as unknown as ReturnType<typeof createAdminClient>);

      // Upload (upsert) to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
      } else {
        // Get the public URL
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);
        publicUrl = urlData.publicUrl;

        // Update the beer's image_url in the database
        if (publicUrl) {
          const { error: updateError } = await supabase
            .from("beers")
            .update({ image_url: publicUrl })
            .eq("id", beerId);

          if (updateError) {
            console.error("DB image_url update error:", updateError);
          }
        }
      }
    }

    // Cleanup temp files
    try {
      fs.unlinkSync(inputPath);
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }

    return NextResponse.json({
      renderUrl: publicUrl || result.renderUrl,
    });
  } catch (err) {
    console.error("Render generation error:", err);
    return NextResponse.json(
      { error: "Render generation failed" },
      { status: 500 }
    );
  }
}
