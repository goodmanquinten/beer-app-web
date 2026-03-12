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
require("dotenv/config");
const commander_1 = require("commander");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const pipeline_1 = require("./pipeline");
const provider_1 = require("./provider");
const gridHtml_1 = require("./gridHtml");
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
function resolveProviders(providerArg) {
    if (providerArg) {
        return (0, provider_1.parseProviders)(providerArg).map((n) => (0, provider_1.createProvider)(n));
    }
    const available = [];
    if (process.env.GOOGLE_API_KEY)
        available.push((0, provider_1.createProvider)('gemini'));
    if (process.env.TOGETHER_API_KEY)
        available.push((0, provider_1.createProvider)('together'));
    if (process.env.GENERATOR_ENDPOINT)
        available.push((0, provider_1.createProvider)('real'));
    if (available.length === 0)
        return [(0, provider_1.createProvider)('mock')];
    return available;
}
function findImages(dir) {
    if (!fs.existsSync(dir)) {
        throw new Error(`Input directory not found: ${dir}`);
    }
    return fs.readdirSync(dir)
        .filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
        .map((f) => path.join(dir, f))
        .sort();
}
const program = new commander_1.Command();
program
    .name('batch')
    .description('Batch run the generator pipeline on a directory of images')
    .requiredOption('--dir <path>', 'Directory containing input images')
    .requiredOption('--type <type>', 'Container type: can or bottle')
    .option('--out <dir>', 'Output directory', 'outputs/batch')
    .option('--style <version>', 'Style version', 'v1')
    .option('--provider <names>', 'Comma-separated providers: mock,gemini,together,real')
    .option('--golden', 'Save golden reference copies')
    .option('--force', 'Overwrite existing golden files')
    .action(async (opts) => {
    const containerType = opts.type;
    if (containerType !== 'can' && containerType !== 'bottle') {
        console.error('Error: --type must be "can" or "bottle"');
        process.exit(1);
    }
    const inputDir = path.resolve(opts.dir);
    const outputDir = path.resolve(opts.out);
    const styleVersion = opts.style;
    const providers = resolveProviders(opts.provider);
    const golden = opts.golden;
    const force = opts.force;
    const images = findImages(inputDir);
    if (images.length === 0) {
        console.error(`No images found in ${inputDir}`);
        process.exit(1);
    }
    console.log(`\nBatch: ${images.length} images from ${inputDir}`);
    console.log(`Type: ${containerType} | Style: ${styleVersion}`);
    console.log(`Providers: ${providers.map((p) => p.name).join(', ')}`);
    console.log(`Output: ${outputDir}\n`);
    fs.mkdirSync(outputDir, { recursive: true });
    const entries = [];
    for (const imgPath of images) {
        const basename = path.basename(imgPath, path.extname(imgPath));
        const subDir = path.join(outputDir, basename);
        console.log(`Processing: ${basename}`);
        try {
            const result = await (0, pipeline_1.runPipeline)({
                inputPath: imgPath,
                containerType,
                outputDir: subDir,
                styleVersion,
                providers,
            });
            entries.push({ basename, inputPath: imgPath, result, error: null });
            // Golden mode — save first provider's render
            if (golden && result.providerOutputs.length > 0) {
                const firstRender = result.providerOutputs.find((po) => po.render_png);
                if (firstRender) {
                    const goldenDir = path.resolve('outputs', 'golden', containerType);
                    fs.mkdirSync(goldenDir, { recursive: true });
                    const goldenPath = path.join(goldenDir, `${basename}.png`);
                    if (!fs.existsSync(goldenPath) || force) {
                        fs.copyFileSync(firstRender.render_png, goldenPath);
                        console.log(`  Golden saved: ${goldenPath}`);
                    }
                    else {
                        console.log(`  Golden exists (use --force to overwrite): ${goldenPath}`);
                    }
                }
            }
            const statuses = result.providerOutputs.map((po) => `${po.provider_name}:${po.validation.passed ? 'PASS' : 'FAIL'}`);
            console.log(`  ${statuses.join(' | ')}\n`);
        }
        catch (err) {
            const msg = err.message;
            console.error(`  ERROR: ${msg}\n`);
            entries.push({ basename, inputPath: imgPath, result: null, error: msg });
        }
    }
    // Write index.html grid
    const htmlPath = path.join(outputDir, 'index.html');
    const html = (0, gridHtml_1.buildGridHtml)(entries, outputDir);
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`Grid HTML: ${htmlPath}`);
    const total = entries.length;
    const errored = entries.filter((e) => e.error).length;
    console.log(`\nSummary: ${total} processed, ${errored} errors`);
});
program.parse();
//# sourceMappingURL=batch.js.map