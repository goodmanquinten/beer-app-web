import { OcrTokens } from './beerspec';
/**
 * OCR module — extracts text from images using tesseract.js.
 * Used for:
 *   1. Reading brand/variant tokens from label crops (input)
 *   2. Spell-checking rendered output images
 */
export declare function extractOcrTokens(_imagePath: string): Promise<OcrTokens>;
/**
 * OCR an image and return all detected words.
 */
export declare function ocrImage(imagePath: string): Promise<string[]>;
export interface SpellCheckResult {
    total_words: number;
    bad_words: string[];
    good_words: string[];
    score: number;
}
/**
 * OCR a rendered image and spell-check all detected words.
 * Returns a report of good/bad words.
 */
export declare function spellCheckRender(imagePath: string): Promise<SpellCheckResult>;
