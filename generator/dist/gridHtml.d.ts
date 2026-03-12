import { PipelineResult } from './pipeline';
interface BatchEntry {
    basename: string;
    inputPath: string;
    result: PipelineResult | null;
    error: string | null;
}
export declare function buildGridHtml(entries: BatchEntry[], outputDir: string): string;
export {};
