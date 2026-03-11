import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/renders?id={beerId}
 * Proxies beer render images from Supabase Storage.
 * Used as fallback when /renders/{id}.png doesn't exist (Vercel deployments).
 */
export async function GET(req: NextRequest) {
  const beerId = req.nextUrl.searchParams.get("id");
  if (!beerId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("beer-renders")
    .download(`${beerId}.png`);

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
