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

  const genDir = path.join(process.cwd(), "generator");

  // Check generator files exist
  const pipelinePath = path.join(genDir, "dist", "pipeline.js");
  results.pipeline = fs.existsSync(pipelinePath) ? "OK" : "MISSING";

  const stylePath = path.join(genDir, "styles", "v1", "knobs.json");
  results.styles = fs.existsSync(stylePath) ? "OK" : "MISSING";

  const templatePath = path.join(genDir, "templates", "can_template.png");
  results.template = fs.existsSync(templatePath) ? "OK" : "MISSING";

  // Try loading modules
  try {
    // eslint-disable-next-line no-eval
    const _require = eval("require") as NodeRequire;
    _require(pipelinePath);
    results.pipelineLoad = "OK";
  } catch (e) {
    results.pipelineLoad = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    // eslint-disable-next-line no-eval
    const _require = eval("require") as NodeRequire;
    _require("sharp");
    results.sharp = "OK";
  } catch (e) {
    results.sharp = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  try {
    // eslint-disable-next-line no-eval
    const _require = eval("require") as NodeRequire;
    _require("node-vibrant");
    results.vibrant = "OK";
  } catch (e) {
    results.vibrant = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
  }

  // Check OPENAI_API_KEY exists
  results.openaiKey = process.env.OPENAI_API_KEY ? "SET" : "MISSING";
  results.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING";

  return NextResponse.json(results);
}
