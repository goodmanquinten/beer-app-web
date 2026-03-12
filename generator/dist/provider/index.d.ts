import { ContainerType } from '../beerspec';
export interface GenerateRequest {
    prompt: string;
    container_type: ContainerType;
    label_crop_path: string;
    template_path?: string;
}
export interface GenerateResult {
    image_buffer: Buffer;
    provider_name: string;
}
export interface GeneratorProvider {
    readonly name: string;
    generate(req: GenerateRequest): Promise<GenerateResult>;
}
export { MockProvider } from './mock';
export { RealProvider } from './real';
export { GeminiProvider } from './gemini';
export { TogetherProvider } from './together';
export { OpenAIProvider } from './openai';
export type ProviderName = 'mock' | 'gemini' | 'together' | 'openai' | 'real';
export declare function createProvider(name: ProviderName): GeneratorProvider;
export declare function parseProviders(input: string): ProviderName[];
