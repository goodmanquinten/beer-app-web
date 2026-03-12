import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const maxDuration = 60;

const BUCKET = "beer-renders";

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createAdminClient(url, serviceKey);
}

export async function POST() {
  const admin = getAdminSupabase();

  // 1. List all files in beer-renders bucket
  const allFiles: string[] = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list("", { limit: pageSize, offset });

    if (error) {
      return NextResponse.json({ error: `List failed: ${error.message}` }, { status: 500 });
    }

    const names = (data || []).map((f: { name: string }) => f.name);
    allFiles.push(...names);

    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  // 2. Delete all files from storage
  let storageDeleted = 0;
  const storageErrors: string[] = [];

  if (allFiles.length > 0) {
    // Supabase storage delete accepts up to 100 files at a time
    for (let i = 0; i < allFiles.length; i += 100) {
      const batch = allFiles.slice(i, i + 100);
      const { error: delError } = await admin.storage
        .from(BUCKET)
        .remove(batch);

      if (delError) {
        storageErrors.push(delError.message);
      } else {
        storageDeleted += batch.length;
      }
    }
  }

  // 3. Null out image_url on all beers
  const { data: updateData, error: updateError } = await admin
    .from("beers")
    .update({ image_url: null })
    .not("image_url", "is", null)
    .select("id");

  const beersUpdated = updateData?.length ?? 0;

  // 4. Verify: fetch a few beers to confirm null image_url
  const { data: sampleBeers } = await admin
    .from("beers")
    .select("id, name, image_url")
    .limit(5);

  return NextResponse.json({
    storage: {
      filesFound: allFiles.length,
      filesDeleted: storageDeleted,
      errors: storageErrors,
    },
    database: {
      beersUpdated,
      updateError: updateError?.message ?? null,
    },
    verification: {
      sampleBeers,
      allImageUrlsNull: (sampleBeers || []).every(
        (b: { image_url: string | null }) => b.image_url === null
      ),
    },
  });
}
