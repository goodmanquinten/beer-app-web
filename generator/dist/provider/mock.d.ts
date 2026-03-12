import { GeneratorProvider, GenerateRequest, GenerateResult } from './index';
/**
 * MockProvider generates a placeholder PNG for local dev.
 * Produces a colored rectangle with the container type label.
 */
export declare class MockProvider implements GeneratorProvider {
    readonly name = "mock";
    generate(req: GenerateRequest): Promise<GenerateResult>;
}
