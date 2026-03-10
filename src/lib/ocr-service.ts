import Tesseract from "tesseract.js";

export interface OCRResult {
  rawText: string;
  lines: string[];
  confidence: number;
}

/**
 * Runs Tesseract OCR on an image file and returns cleaned text results.
 * Filters out low-confidence noise and short fragments.
 */
export async function extractTextFromImage(
  imageSource: File | string
): Promise<OCRResult> {
  const {
    data: { text, confidence, blocks },
  } = await Tesseract.recognize(imageSource, "eng", {
    logger: () => {}, // suppress logs
  });

  // Extract lines from blocks → paragraphs → lines
  const allLines: { text: string; confidence: number }[] = [];
  if (blocks && Array.isArray(blocks)) {
    for (const block of blocks) {
      for (const paragraph of block.paragraphs ?? []) {
        for (const line of paragraph.lines ?? []) {
          allLines.push({ text: line.text, confidence: line.confidence });
        }
      }
    }
  }

  // Clean lines: trim whitespace, drop empty/very short lines and low-confidence noise
  let cleanedLines = allLines
    .filter((line) => line.confidence > 30 && line.text.trim().length > 1)
    .map((line) => line.text.trim());

  // Fallback: if block parsing yielded nothing, split raw text into lines
  if (cleanedLines.length === 0 && text.trim().length > 0) {
    cleanedLines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 1);
  }

  return {
    rawText: text.trim(),
    lines: cleanedLines,
    confidence: confidence ?? 0,
  };
}

/**
 * Extracts likely beer-related keywords from OCR lines.
 * Splits lines into individual words, filters out very short tokens
 * and common noise words found on labels.
 */
export function extractSearchTerms(lines: string[]): string[] {
  const noiseWords = new Set([
    "the", "and", "of", "for", "with", "from", "beer", "ale", "brew",
    "brewed", "brewing", "company", "co", "inc", "ltd", "est",
    "vol", "abv", "oz", "ml", "fl", "net", "wt", "contains",
  ]);

  const terms: string[] = [];

  for (const line of lines) {
    // Keep full lines that look like names (2-4 words, mostly alpha)
    const wordCount = line.split(/\s+/).length;
    if (wordCount >= 2 && wordCount <= 5 && /^[A-Za-z\s'-]+$/.test(line)) {
      terms.push(line);
    }

    // Also add individual significant words
    for (const word of line.split(/\s+/)) {
      const cleaned = word.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
      if (cleaned.length >= 3 && !noiseWords.has(cleaned)) {
        if (!terms.some((t) => t.toLowerCase() === cleaned)) {
          terms.push(cleaned);
        }
      }
    }
  }

  return terms;
}
