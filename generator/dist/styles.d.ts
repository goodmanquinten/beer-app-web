import { ContainerType, StyleKnobs } from './beerspec';
export interface StylePack {
    global: string;
    container: string;
    negative: string;
    knobs: StyleKnobs;
}
export declare function loadKnobs(styleDir: string): StyleKnobs;
export declare function loadStylePack(styleVersion: string, containerType: ContainerType): StylePack;
