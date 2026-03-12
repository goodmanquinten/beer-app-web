import { PaletteColor } from './beerspec';
/**
 * Extract dominant palette colors from an image.
 * Returns up to `count` colors sorted by population weight (descending).
 */
export declare function extractPalette(imagePath: string, count?: number): Promise<PaletteColor[]>;
