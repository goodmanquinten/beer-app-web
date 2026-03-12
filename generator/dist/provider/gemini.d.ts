import { GeneratorProvider, GenerateRequest, GenerateResult } from './index';
/**
 * GeminiProvider uses Google's Gemini API for image generation.
 * Sends prompt text + label crop as inline base64 image.
 * Requires GOOGLE_API_KEY env var.
 */
export declare class GeminiProvider implements GeneratorProvider {
    readonly name = "gemini";
    private apiKey;
    constructor();
    generate(req: GenerateRequest): Promise<GenerateResult>;
    private post;
}
