import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;
const IDENTIFY_MODEL = "gpt-4o";
const IDENTIFY_PROMPT = `Look at this photo of a beer can or bottle. Identify the beer and the package type. Return ONLY a JSON object with these fields:
- "name": the beer name
- "brewery": the brewery name
- "style": the beer style if visible, or "Beer" if unsure
- "containerType": MUST be exactly "can" or "bottle"
- "searchTerms": an array of up to 8 short terms copied from the visible label text that would help match an existing beer in the database

Container rules:
- If the package has a long neck, glass body, or crown cap, it is "bottle"
- If the package has a pull tab aluminum top, it is "can"
- Do not guess "can" by default. Detect the package from the image.

If OCR text is provided, use it as supporting evidence but do not invent text that is not visible.
Return ONLY the JSON, no markdown, no explanation.`;

type BeerIdentification = {
  name?: unknown;
  brewery?: unknown;
  style?: unknown;
  containerType?: unknown;
  container_type?: unknown;
  packageType?: unknown;
  package_type?: unknown;
  searchTerms?: unknown;
};

function normalizeContainerType(value: unknown): "can" | "bottle" {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, " ");

  if (
    normalized.includes("bottle") ||
    normalized.includes("longneck") ||
    normalized.includes("glass")
  ) {
    return "bottle";
  }

  return "can";
}

function normalizeSearchTerms(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((term) => String(term ?? "").trim().toLowerCase())
        .filter((term) => term.length >= 3)
        .slice(0, 8)
    )
  );
}

function tryParseJsonObject(content: string): BeerIdentification | null {
  const trimmed = content.trim();
  if (!trimmed) {
    return null;
  }

  const candidates = [
    trimmed,
    trimmed.replace(/```json?\s*/gi, "").replace(/```/g, "").trim(),
  ];

  const startIndex = trimmed.indexOf("{");
  const endIndex = trimmed.lastIndexOf("}");
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    candidates.push(trimmed.slice(startIndex, endIndex + 1).trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as BeerIdentification;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function hasRequiredFields(parsed: BeerIdentification | null): parsed is BeerIdentification {
  return Boolean(
    parsed &&
      typeof parsed === "object" &&
      (parsed.name ||
        parsed.brewery ||
        parsed.style ||
        parsed.containerType ||
        parsed.container_type ||
        parsed.searchTerms)
  );
}

async function identifyBeer({
  apiKey,
  imageDataUrl,
  ocrText,
  ocrTerms,
  retryContent,
}: {
  apiKey: string;
  imageDataUrl: string;
  ocrText?: string;
  ocrTerms?: string[];
  retryContent?: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const content: any[] = [
    { type: "text", text: IDENTIFY_PROMPT },
  ];

  if (ocrText || (ocrTerms && ocrTerms.length > 0)) {
    content.push({
      type: "text",
      text: `OCR support text:
rawText=${ocrText || ""}
searchTerms=${(ocrTerms ?? []).join(", ")}`,
    });
  }

  content.push({ type: "image_url", image_url: { url: imageDataUrl, detail: "auto" } });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages: any[] = [{ role: "user", content }];

  if (retryContent) {
    messages.push({ role: "assistant", content: retryContent });
    messages.push({
      role: "user",
      content:
        'Your previous reply was not valid JSON. Return only a valid JSON object with exactly these keys: "name", "brewery", "style", "containerType", "searchTerms".',
    });
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: IDENTIFY_MODEL,
      messages,
      max_tokens: 220,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { imageDataUrl, ocrText, ocrTerms } = await req.json();
  if (!imageDataUrl) {
    return NextResponse.json(
      { error: "imageDataUrl is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

  try {
    const firstContent = await identifyBeer({
      apiKey,
      imageDataUrl,
      ocrText,
      ocrTerms,
    });
    let parsed = tryParseJsonObject(firstContent);

    if (!hasRequiredFields(parsed)) {
      const retryContent = await identifyBeer({
        apiKey,
        imageDataUrl,
        ocrText,
        ocrTerms,
        retryContent: firstContent,
      });
      parsed = tryParseJsonObject(retryContent);
    }

    if (!hasRequiredFields(parsed)) {
      return NextResponse.json(
        { error: "Failed to identify beer from this image" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      name: String(parsed.name || "").trim() || "Unknown Beer",
      brewery: String(parsed.brewery || "").trim(),
      style: String(parsed.style || "").trim() || "Beer",
      containerType: normalizeContainerType(
        parsed.containerType ?? parsed.container_type ?? parsed.packageType ?? parsed.package_type
      ),
      searchTerms: normalizeSearchTerms(parsed.searchTerms),
    });
  } catch (err) {
    console.error("Beer identification error:", err);
    return NextResponse.json(
      { error: "Failed to identify beer" },
      { status: 500 }
    );
  }
}
