import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * GET /api/generate-render/test
 * Quick health check that verifies the pipeline can be loaded on Vercel.
 * No auth required — just tests module resolution.
 */
export async function GET() {
  const results: Record<string, string> = {};

  // eslint-disable-next-line no-eval
  const _require = eval("require") as NodeRequire;
  const genDir = path.join(process.cwd(), "generator");

  // Check generator files exist
  const pipelinePath = path.join(genDir, "dist", "pipeline.js");
  results.pipeline = fs.existsSync(pipelinePath) ? "OK" : "MISSING";
  results.styles = fs.existsSync(path.join(genDir, "styles", "v1", "knobs.json")) ? "OK" : "MISSING";
  results.template = fs.existsSync(path.join(genDir, "templates", "can_template.png")) ? "OK" : "MISSING";

  // Pre-inject palette stub (node-vibrant has too many transitive deps)
  const Module = _require("module");
  const paletteCachePath = path.join(genDir, "dist", "palette.js");
  Module._cache[paletteCachePath] = {
    id: paletteCachePath,
    filename: paletteCachePath,
    loaded: true,
    exports: {
      extractPalette: async () => ["#c4873a", "#a06830", "#7a4f25", "#f5e6d0", "#1a1a1a"],
    },
  };

  // Try loading pipeline (with palette stubbed out)
  try {
    _require(pipelinePath);
    results.pipelineLoad = "OK";
  } catch (e) {
    results.pipelineLoad = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test sharp
  try {
    _require("sharp");
    results.sharp = "OK";
  } catch (e) {
    results.sharp = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Test OpenAI provider
  try {
    _require(path.join(genDir, "dist", "provider", "openai.js"));
    results.openaiProvider = "OK";
  } catch (e) {
    results.openaiProvider = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  results.openaiKey = process.env.OPENAI_API_KEY ? "SET" : "MISSING";
  results.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING";

  return NextResponse.json(results);
}
