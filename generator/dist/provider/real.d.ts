import { GeneratorProvider, GenerateRequest, GenerateResult } from './index';
/**
 * RealProvider sends the prompt + images to a configurable HTTP endpoint.
 * No vendor SDK required — just multipart/form-data over HTTP(S).
 *
 * Env vars:
 *   GENERATOR_ENDPOINT — full URL (required)
 *   GENERATOR_API_KEY  — optional auth header value
 */
export declare class RealProvider implements GeneratorProvider {
    readonly name = "real";
    private endpoint;
    private apiKey;
    constructor();
    generate(req: GenerateRequest): Promise<GenerateResult>;
    private postForm;
}
