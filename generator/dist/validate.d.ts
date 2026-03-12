export interface ValidationResult {
    has_transparency: boolean;
    is_square: boolean;
    is_target_size: boolean;
    is_centered: boolean;
    is_cropped: boolean;
    bbox: {
        left: number;
        top: number;
        right: number;
        bottom: number;
    } | null;
    passed: boolean;
    issues: string[];
}
/**
 * Validate the generated render image.
 * - Must have alpha channel (transparency present)
 * - Must be square at the target size
 * - Container should be roughly centered (non-transparent bounding box within 10% margins)
 */
export declare function validateRender(renderBuffer: Buffer, targetSize: number): Promise<{
    validated: Buffer;
    result: ValidationResult;
}>;
