import { BeerSpec } from './beerspec';
import { StylePack } from './styles';
export declare function buildPrompt(stylePack: StylePack, spec: BeerSpec, hasTemplate: boolean): string;
/**
 * Detailed structured prompt for multimodal models that can see reference images.
 */
export declare function buildDetailedPrompt(stylePack: StylePack, spec: BeerSpec, hasTemplate: boolean): string;
