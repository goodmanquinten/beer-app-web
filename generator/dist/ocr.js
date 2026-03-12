"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractOcrTokens = extractOcrTokens;
exports.ocrImage = ocrImage;
exports.spellCheckRender = spellCheckRender;
const tesseract_js_1 = __importDefault(require("tesseract.js"));
/**
 * OCR module — extracts text from images using tesseract.js.
 * Used for:
 *   1. Reading brand/variant tokens from label crops (input)
 *   2. Spell-checking rendered output images
 */
async function extractOcrTokens(_imagePath) {
    // Stub for input label OCR — not yet wired up for brand detection
    // To enable: uncomment the lines below
    // const words = await ocrImage(_imagePath);
    // return { brand_tokens: words.slice(0, 3), variant_tokens: words.slice(3, 6) };
    return { brand_tokens: [], variant_tokens: [] };
}
/**
 * OCR an image and return all detected words.
 */
async function ocrImage(imagePath) {
    const result = await tesseract_js_1.default.recognize(imagePath, 'eng');
    const text = result.data.text || '';
    // Split on whitespace and punctuation, keep only word-like tokens
    const words = text
        .split(/[\s,.\-;:!?'"()\[\]{}|/\\]+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 2 && /^[a-zA-Z]+$/.test(w));
    return words;
}
// Common English words + beer terms for spell checking
const KNOWN_WORDS = new Set([
    // Beer-specific
    'beer', 'ale', 'lager', 'ipa', 'stout', 'porter', 'pilsner', 'wheat', 'hazy', 'pale',
    'craft', 'brew', 'brewed', 'brewing', 'brewery', 'original', 'premium', 'quality',
    'imported', 'export', 'draft', 'draught', 'light', 'lite', 'extra', 'special', 'reserve',
    'gold', 'golden', 'amber', 'dark', 'double', 'triple', 'finest', 'select', 'classic',
    'est', 'established', 'since', 'anno', 'founded', 'tradition', 'traditional',
    'hops', 'malt', 'barley', 'water', 'yeast', 'ingredients',
    'registered', 'trademark', 'trade', 'mark',
    // Common English
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'not', 'are', 'but',
    'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get',
    'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see',
    'way', 'who', 'did', 'let', 'say', 'she', 'too', 'use',
    'little', 'thing', 'things', 'great', 'small', 'big', 'best',
    'company', 'product', 'world', 'city', 'country', 'place',
    // Geography common in beer
    'amsterdam', 'holland', 'netherlands', 'germany', 'munich', 'bavaria',
    'mexico', 'ireland', 'dublin', 'belgium', 'czech', 'japan', 'america',
    'colorado', 'california', 'oregon', 'wisconsin', 'milwaukee', 'denver',
    'sierra', 'nevada', 'pacific', 'atlantic', 'mountain', 'river', 'lake',
    // Numbers and abbreviations
    'vol', 'alc', 'abv', 'oz', 'ml', 'cl', 'fl',
]);
// Well-known beer brand names
const KNOWN_BRANDS = new Set([
    'heineken', 'budweiser', 'corona', 'guinness', 'stella', 'artois',
    'modelo', 'pacifico', 'tecate', 'dos', 'equis', 'negra',
    'coors', 'miller', 'pbr', 'pabst', 'busch', 'michelob', 'ultra',
    'bud', 'light', 'lagunitas', 'dogfish', 'head', 'founders',
    'bells', 'sierra', 'nevada', 'samuel', 'adams', 'blue', 'moon',
    'goose', 'island', 'voodoo', 'ranger', 'fat', 'tire',
    'sweetwater', 'deschutes', 'firestone', 'walker', 'stone',
    'ballast', 'point', 'hazy', 'little', 'thing',
    'sapporo', 'asahi', 'kirin', 'tsing', 'tao', 'tiger',
    'peroni', 'moretti', 'leffe', 'hoegaarden', 'chimay',
    'diplome', 'honneur', 'brewed',
]);
/**
 * OCR a rendered image and spell-check all detected words.
 * Returns a report of good/bad words.
 */
async function spellCheckRender(imagePath) {
    const words = await ocrImage(imagePath);
    const good_words = [];
    const bad_words = [];
    for (const word of words) {
        const clean = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
        if (clean.length < 2)
            continue;
        // Check if it's a number or abbreviation
        if (/^\d+$/.test(word)) {
            good_words.push(word);
            continue;
        }
        if (KNOWN_WORDS.has(clean) || KNOWN_BRANDS.has(clean)) {
            good_words.push(word);
        }
        else {
            bad_words.push(word);
        }
    }
    const total = good_words.length + bad_words.length;
    const score = total > 0 ? good_words.length / total : 1;
    return { total_words: total, bad_words, good_words, score };
}
//# sourceMappingURL=ocr.js.map