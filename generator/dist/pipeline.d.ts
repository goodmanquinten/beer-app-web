import { ContainerType, BeerSpec } from './beerspec';
import { SpellCheckResult } from './ocr';
import { GeneratorProvider } from './provider';
import { ValidationResult } from './validate';
export interface PipelineOptions {
    inputPath: string;
    containerType: ContainerType;
    outputDir: string;
    styleVersion: string;
    providers: GeneratorProvider[];
    brandName?: string;
    variantName?: string;
}
export interface ProviderOutput {
    provider_name: string;
    render_png: string;
    report_json: string;
    validation: ValidationResult;
    spellCheck?: SpellCheckResult;
}
export interface PipelineResult {
    spec: BeerSpec;
    prompt: string;
    providerOutputs: ProviderOutput[];
    outputs: {
        prompt_txt: string;
        spec_json: string;
        labelcrop_png: string;
    };
}
export declare function runPipeline(opts: PipelineOptions): Promise<PipelineResult>;
