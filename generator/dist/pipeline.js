"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPipeline = runPipeline;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const styles_1 = require("./styles");
const crop_1 = require("./crop");
const palette_1 = require("./palette");
const ocr_1 = require("./ocr");
const promptBuilder_1 = require("./promptBuilder");
const validate_1 = require("./validate");
function getTemplatePath(containerType) {
    const templateFile = containerType === 'can' ? 'can_template.png' : 'bottle_template.png';
    const p = path.resolve(__dirname, '..', 'templates', templateFile);
    return fs.existsSync(p) ? p : undefined;
}
async function runPipeline(opts) {
    const { inputPath, containerType, outputDir, styleVersion, providers } = opts;
    if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
    }
    fs.mkdirSync(outputDir, { recursive: true });
    const basename = path.basename(inputPath, path.extname(inputPath));
    // 1) Load style pack
    const stylePack = (0, styles_1.loadStylePack)(styleVersion, containerType);
    const knobs = stylePack.knobs;
    // 2) Preprocess image
    console.log('  Preprocessing image...');
    const preprocessedPath = await (0, crop_1.preprocessImage)(inputPath, outputDir);
    // 3) Crop label
    console.log('  Cropping label...');
    const labelCropPath = await (0, crop_1.cropLabel)(preprocessedPath, outputDir, knobs.crop);
    // 4) Extract palette
    console.log('  Extracting palette...');
    const palette = await (0, palette_1.extractPalette)(labelCropPath, 5);
    // 5) OCR (stub)
    console.log('  Running OCR (stub)...');
    const ocrTokens = await (0, ocr_1.extractOcrTokens)(labelCropPath);
    // 6) Build BeerSpec
    const spec = {
        container_type: containerType,
        palette,
        identity: {
            brand_name: opts.brandName ?? '',
            variant_name: opts.variantName ?? '',
            brand_tokens: ocrTokens.brand_tokens,
            variant_tokens: ocrTokens.variant_tokens,
        },
        knobs,
        source_image: inputPath,
        label_crop_path: labelCropPath,
    };
    // 7) Build prompt
    const templatePath = getTemplatePath(containerType);
    const prompt = (0, promptBuilder_1.buildPrompt)(stylePack, spec, !!templatePath);
    // Write shared outputs
    const sharedOutputs = {
        prompt_txt: path.join(outputDir, `${basename}_prompt.txt`),
        spec_json: path.join(outputDir, `${basename}_spec.json`),
        labelcrop_png: path.join(outputDir, `${basename}_labelcrop.png`),
    };
    fs.writeFileSync(sharedOutputs.prompt_txt, prompt, 'utf-8');
    fs.writeFileSync(sharedOutputs.spec_json, JSON.stringify(spec, null, 2), 'utf-8');
    fs.copyFileSync(labelCropPath, sharedOutputs.labelcrop_png);
    // 8) Run each provider
    const providerOutputs = [];
    for (const provider of providers) {
        console.log(`  Generating with ${provider.name} provider...`);
        try {
            const genResult = await provider.generate({
                prompt,
                container_type: containerType,
                label_crop_path: labelCropPath,
                template_path: templatePath,
            });
            // 9) Validate
            console.log(`  Validating ${provider.name} output...`);
            const { validated, result: validation } = await (0, validate_1.validateRender)(genResult.image_buffer, knobs.output_size);
            const suffix = providers.length > 1 ? `_${provider.name}` : '';
            const renderPath = path.join(outputDir, `${basename}_render${suffix}.png`);
            const reportPath = path.join(outputDir, `${basename}_report${suffix}.json`);
            fs.writeFileSync(renderPath, validated);
            // 10) Spell check the rendered text
            console.log(`  Spell-checking ${provider.name} output...`);
            const spellCheck = await (0, ocr_1.spellCheckRender)(renderPath);
            if (spellCheck.bad_words.length > 0) {
                console.log(`  ⚠ Misspelled/unknown words: ${spellCheck.bad_words.join(', ')}`);
            }
            else {
                console.log(`  Text check: ${spellCheck.total_words} words, all OK`);
            }
            const report = {
                palette,
                validation,
                spellCheck,
                provider: genResult.provider_name,
                timestamp: new Date().toISOString(),
            };
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
            providerOutputs.push({
                provider_name: provider.name,
                render_png: renderPath,
                report_json: reportPath,
                validation,
                spellCheck,
            });
        }
        catch (err) {
            console.error(`  ${provider.name} failed: ${err.message}`);
            providerOutputs.push({
                provider_name: provider.name,
                render_png: '',
                report_json: '',
                validation: {
                    has_transparency: false,
                    is_square: false,
                    is_target_size: false,
                    is_centered: false,
                    is_cropped: false,
                    bbox: null,
                    passed: false,
                    issues: [`Provider error: ${err.message}`],
                },
            });
        }
    }
    // Cleanup temp files
    for (const tmp of [preprocessedPath, labelCropPath]) {
        if (fs.existsSync(tmp) && tmp !== sharedOutputs.labelcrop_png) {
            fs.unlinkSync(tmp);
        }
    }
    return { spec, prompt, providerOutputs, outputs: sharedOutputs };
}
//# sourceMappingURL=pipeline.js.map