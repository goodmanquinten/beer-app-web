import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { imageDataUrl } = await req.json();
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
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Look at this photo of a beer can or bottle. Identify the beer. Return ONLY a JSON object with these fields:
- "name": the beer name (e.g. "Bud Light", "Hazy Little Thing IPA")
- "brewery": the brewery name (e.g. "Anheuser-Busch", "Sierra Nevada")
- "style": the beer style if visible (e.g. "IPA", "Lager", "Stout"), or "Beer" if unsure

Return ONLY the JSON, no markdown, no explanation.`,
              },
              {
                type: "image_url",
                image_url: { url: imageDataUrl, detail: "low" },
              },
            ],
          },
        ],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI API error:", err);
      return NextResponse.json(
        { error: "Failed to identify beer" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() ?? "";

    // Parse JSON from response (strip markdown fences if present)
    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    return NextResponse.json({
      name: parsed.name || "Unknown Beer",
      brewery: parsed.brewery || "Unknown Brewery",
      style: parsed.style || "Beer",
    });
  } catch (err) {
    console.error("Beer identification error:", err);
    return NextResponse.json(
      { error: "Failed to identify beer" },
      { status: 500 }
    );
  }
}
