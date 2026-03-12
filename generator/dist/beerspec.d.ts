export type ContainerType = 'can' | 'bottle';
export interface PaletteColor {
    hex: string;
    weight: number;
}
export interface OcrTokens {
    brand_tokens: string[];
    variant_tokens: string[];
}
export interface StyleKnobs {
    output_size: number;
    crop: {
        width_ratio: number;
        height_ratio: number;
    };
    outline: {
        thickness: string;
    };
    shading: {
        mode: string;
        bands: number;
    };
    pose: string;
    lighting: {
        key: string;
        rim: string;
        shadow: string;
    };
}
export interface BeerSpec {
    container_type: ContainerType;
    palette: PaletteColor[];
    identity: {
        brand_name: string;
        variant_name: string;
        brand_tokens: string[];
        variant_tokens: string[];
    };
    knobs: StyleKnobs;
    source_image: string;
    label_crop_path: string;
}
export declare const DEFAULT_KNOBS: StyleKnobs;
