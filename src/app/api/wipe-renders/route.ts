import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
  }

  const admin = createAdminClient(url, serviceKey);

  // List ALL files in the bucket using anon-style listing
  const { data: files, error: listError } = await admin.storage
    .from("beer-renders")
    .list("", { limit: 1000 });

  if (listError) {
    return NextResponse.json({ error: `List: ${listError.message}` }, { status: 500 });
  }

  const fileNames = (files || []).map((f: { name: string }) => f.name);

  if (fileNames.length === 0) {
    return NextResponse.json({ message: "No files found", fileNames: [] });
  }

  // Delete all files
  const { data: deleted, error: delError } = await admin.storage
    .from("beer-renders")
    .remove(fileNames);

  if (delError) {
    return NextResponse.json({ error: `Delete: ${delError.message}`, fileNames }, { status: 500 });
  }

  // Null out image_url on all beers
  const { error: dbError } = await admin
    .from("beers")
    .update({ image_url: null })
    .not("image_url", "is", null);

  // Verify bucket is empty
  const { data: remaining } = await admin.storage
    .from("beer-renders")
    .list("", { limit: 100 });

  return NextResponse.json({
    deleted: fileNames,
    deleteResult: deleted,
    dbError: dbError?.message ?? null,
    remainingFiles: (remaining || []).map((f: { name: string }) => f.name),
  });
}
