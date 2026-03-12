"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractPalette = extractPalette;
const node_vibrant_1 = __importDefault(require("node-vibrant"));
/**
 * Extract dominant palette colors from an image.
 * Returns up to `count` colors sorted by population weight (descending).
 */
async function extractPalette(imagePath, count = 5) {
    const palette = await node_vibrant_1.default.from(imagePath).maxColorCount(64).getPalette();
    const entries = [];
    for (const swatch of Object.values(palette)) {
        if (swatch) {
            entries.push({ hex: swatch.hex, population: swatch.population });
        }
    }
    entries.sort((a, b) => b.population - a.population);
    const totalPop = entries.reduce((sum, e) => sum + e.population, 0);
    const result = entries.slice(0, count).map((e) => ({
        hex: e.hex,
        weight: totalPop > 0 ? Math.round((e.population / totalPop) * 1000) / 1000 : 0,
    }));
    return result;
}
//# sourceMappingURL=palette.js.map