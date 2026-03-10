import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";

export const maxDuration = 60;

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

    // Cleanup temp files
    try {
      fs.unlinkSync(inputPath);
      fs.rmSync(outputDir, { recursive: true, force: true });
    } catch {
      // best-effort
    }

    return NextResponse.json({ renderUrl: result.renderUrl });
  } catch (err) {
    console.error("Render generation error:", err);
    return NextResponse.json(
      { error: "Render generation failed" },
      { status: 500 }
    );
  }
}
