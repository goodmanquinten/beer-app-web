import { GeneratorProvider, GenerateRequest, GenerateResult } from './index';
/**
 * TogetherProvider uses Together AI's free Flux Schnell model.
 * Text-to-image only (no reference image input on this model).
 * Requires TOGETHER_API_KEY env var.
 */
export declare class TogetherProvider implements GeneratorProvider {
    readonly name = "together";
    private apiKey;
    constructor();
    generate(req: GenerateRequest): Promise<GenerateResult>;
    private post;
    private fetchImage;
}
