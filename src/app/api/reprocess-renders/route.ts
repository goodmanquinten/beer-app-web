import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import sharp from "sharp";

export const maxDuration = 300;

const BUCKET = "beer-renders";
const ALPHA_THRESHOLD = 20;

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createAdminClient(url, serviceKey);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function listAllPngFiles(admin: any) {
  const allFiles: Array<{ name: string }> = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list("", { limit: pageSize, offset });

    if (error) {
      return { error: error.message };
    }

    const pageFiles = (data || []).filter((file) => file.name.endsWith(".png"));
    allFiles.push(...pageFiles);

    if (!data || data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return { data: allFiles };
}

async function removeDetachedShadow(buf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const visited = new Uint8Array(width * height);
  const components: Array<{ pixels: number[]; size: number }> = [];

  const indexFor = (x: number, y: number) => y * width + x;
  const alphaAt = (idx: number) => data[idx * channels + 3];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = indexFor(x, y);
      if (visited[start] || alphaAt(start) <= ALPHA_THRESHOLD) continue;

      const queue = [start];
      const pixels: number[] = [];
      visited[start] = 1;

      while (queue.length > 0) {
        const current = queue.pop()!;
        pixels.push(current);

        const cx = current % width;
        const cy = Math.floor(current / width);

        for (const [nx, ny] of [
          [cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1],
        ]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = indexFor(nx, ny);
          if (visited[next] || alphaAt(next) <= ALPHA_THRESHOLD) continue;
          visited[next] = 1;
          queue.push(next);
        }
      }

      components.push({ pixels, size: pixels.length });
    }
  }

  if (components.length <= 1) {
    return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  }

  const largest = components.reduce((best, c) => (c.size > best.size ? c : best));
  const keep = new Uint8Array(width * height);
  for (const pixel of largest.pixels) keep[pixel] = 1;

  for (let idx = 0; idx < width * height; idx++) {
    if (!keep[idx]) data[idx * channels + 3] = 0;
  }

  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

export async function POST() {
  const admin = getAdminSupabase();

  const listResult = await listAllPngFiles(admin);
  if (listResult.error) {
    return NextResponse.json({ error: listResult.error }, { status: 500 });
  }

  const pngFiles = listResult.data;
  const results: Array<{ file: string; status: string }> = [];

  for (const file of pngFiles) {
    try {
      // Download the current render
      const { data: blob, error: dlError } = await admin.storage
        .from(BUCKET)
        .download(file.name);

      if (dlError || !blob) {
        results.push({ file: file.name, status: `download failed: ${dlError?.message}` });
        continue;
      }

      const originalBuf = Buffer.from(await blob.arrayBuffer());

      // Trim transparent padding
      const trimmed = await sharp(originalBuf).trim({ threshold: 10 }).toBuffer();
      const margin = 20;
      const extended = await sharp(trimmed)
        .extend({
          top: margin, bottom: margin, left: margin, right: margin,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();

      // Remove detached shadows
      const cleaned = await removeDetachedShadow(extended);

      // Re-upload, overwriting the original
      const { error: uploadError } = await admin.storage
        .from(BUCKET)
        .upload(file.name, cleaned, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        results.push({ file: file.name, status: `upload failed: ${uploadError.message}` });
      } else {
        results.push({ file: file.name, status: "ok" });
      }
    } catch (err) {
      results.push({
        file: file.name,
        status: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const succeeded = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status !== "ok").length;

  return NextResponse.json({
    total: pngFiles.length,
    succeeded,
    failed,
    results,
  });
}
