import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";

// Force Next.js file tracer to include pipeline dependencies and all their
// transitive deps (e.g. detect-libc, color, semver, @jimp/*).
// These are used by the child process (scripts/run-render.js → generator/*).
import "sharp";
import "node-vibrant";

export const maxDuration = 60;

const BUCKET = "beer-renders";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, serviceKey);
}

function runScript(args: string[], env: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "run-render.js");
    console.log("Running render script:", scriptPath);
    console.log("CWD:", process.cwd());
    console.log("Generator exists:", fs.existsSync(path.join(process.cwd(), "generator", "dist", "pipeline.js")));

    execFile("node", [scriptPath, ...args], {
      env: { ...process.env, ...env },
      timeout: 55000, // Stay under Vercel's 60s limit
    }, (error, stdout, stderr) => {
      if (stderr) console.log("Pipeline log:", stderr.slice(0, 1000));
      const output = stdout.trim();
      console.log("Pipeline stdout:", output.slice(0, 500));
      if (error) {
        console.error("Pipeline exec error:", error.message);
        if (!output) {
          reject(new Error(error.message));
          return;
        }
      }
      if (!output) {
        reject(new Error("No output from render script"));
      } else {
        resolve(output);
      }
    });
  });
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

      // Use admin client for storage operations (bypasses RLS)
      const admin = getAdminSupabase();

      // Upload (upsert) to Supabase Storage
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
      } else {
        // Get the public URL
        const { data: urlData } = admin.storage
          .from(BUCKET)
          .getPublicUrl(storagePath);
        publicUrl = urlData.publicUrl;

        // Update the beer's image_url in the database
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
      console.error("Render file not found at:", localRenderPath);
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
      { error: err instanceof Error ? err.message : "Render generation failed" },
      { status: 500 }
    );
  }
}
