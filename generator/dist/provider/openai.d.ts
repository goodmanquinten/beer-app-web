import { GeneratorProvider, GenerateRequest, GenerateResult } from './index';
/**
 * OpenAI provider using gpt-image-1.
 * Uses /images/edits when a label crop is available (sends the reference image).
 * Uses /images/generations as fallback.
 * Requires OPENAI_API_KEY env var.
 */
export declare class OpenAIProvider implements GeneratorProvider {
    readonly name = "openai";
    private apiKey;
    constructor();
    generate(req: GenerateRequest): Promise<GenerateResult>;
    private editWithReference;
    private generateFromText;
    private parseResponse;
    private post;
}
