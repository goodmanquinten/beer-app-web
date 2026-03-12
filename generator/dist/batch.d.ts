import 'dotenv/config';
import { PipelineResult } from './pipeline';
export interface BatchEntry {
    basename: string;
    inputPath: string;
    result: PipelineResult | null;
    error: string | null;
}
