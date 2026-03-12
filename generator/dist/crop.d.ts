export interface CropConfig {
    width_ratio: number;
    height_ratio: number;
}
/**
 * Resize the input image so the longest edge is at most MAX_PREPROCESS_PX.
 * Returns the path to the resized image (written to outDir).
 */
export declare function preprocessImage(inputPath: string, outDir: string): Promise<string>;
/**
 * Crop the center portion of the image for label extraction.
 * Uses configurable ratios for width and height.
 */
export declare function cropLabel(preprocessedPath: string, outDir: string, config: CropConfig): Promise<string>;
