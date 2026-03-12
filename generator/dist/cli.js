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
const path = __importStar(require("path"));
const pipeline_1 = require("./pipeline");
const provider_1 = require("./provider");
function resolveProviders(providerArg) {
    if (providerArg) {
        const names = (0, provider_1.parseProviders)(providerArg);
        return names.map((n) => (0, provider_1.createProvider)(n));
    }
    // Auto-detect: use real providers if keys are set, otherwise mock
    const available = [];
    if (process.env.OPENAI_API_KEY) {
        available.push((0, provider_1.createProvider)('openai'));
    }
    if (process.env.GOOGLE_API_KEY) {
        available.push((0, provider_1.createProvider)('gemini'));
    }
    if (process.env.TOGETHER_API_KEY) {
        available.push((0, provider_1.createProvider)('together'));
    }
    if (process.env.GENERATOR_ENDPOINT) {
        available.push((0, provider_1.createProvider)('real'));
    }
    if (available.length === 0) {
        console.log('No API keys found, using MockProvider');
        return [(0, provider_1.createProvider)('mock')];
    }
    console.log(`Using providers: ${available.map((p) => p.name).join(', ')}`);
    return available;
}
const program = new commander_1.Command();
program
    .name('gen')
    .description('Beer can/bottle image generator playground')
    .requiredOption('--in <path>', 'Path to input photo (logo visible)')
    .requiredOption('--type <type>', 'Container type: can or bottle')
    .option('--out <dir>', 'Output directory', 'outputs')
    .option('--style <version>', 'Style version', 'v1')
    .option('--provider <names>', 'Comma-separated providers: mock,gemini,together,real')
    .option('--brand <name>', 'Brand name (e.g. "Bud Light")')
    .option('--variant <name>', 'Variant name (e.g. "Lager")')
    .action(async (opts) => {
    const containerType = opts.type;
    if (containerType !== 'can' && containerType !== 'bottle') {
        console.error('Error: --type must be "can" or "bottle"');
        process.exit(1);
    }
    const inputPath = path.resolve(opts.in);
    const outputDir = path.resolve(opts.out);
    const styleVersion = opts.style;
    const providers = resolveProviders(opts.provider);
    console.log(`\nGenerating ${containerType} from ${inputPath}`);
    console.log(`Style: ${styleVersion} | Output: ${outputDir}\n`);
    try {
        const result = await (0, pipeline_1.runPipeline)({
            inputPath,
            containerType,
            outputDir,
            styleVersion,
            providers,
            brandName: opts.brand,
            variantName: opts.variant,
        });
        console.log('\nDone!');
        console.log(`  Prompt:  ${result.outputs.prompt_txt}`);
        console.log(`  Spec:    ${result.outputs.spec_json}`);
        console.log(`  Crop:    ${result.outputs.labelcrop_png}`);
        for (const po of result.providerOutputs) {
            console.log(`\n  [${po.provider_name}]`);
            if (po.render_png) {
                console.log(`    Render: ${po.render_png}`);
                console.log(`    Report: ${po.report_json}`);
            }
            if (!po.validation.passed) {
                console.log('    Validation issues:');
                for (const issue of po.validation.issues) {
                    console.log(`      - ${issue}`);
                }
            }
            else {
                console.log('    Validation: PASSED');
            }
            if (po.spellCheck) {
                if (po.spellCheck.bad_words.length > 0) {
                    console.log(`    Text issues: ${po.spellCheck.bad_words.join(', ')}`);
                }
                else {
                    console.log(`    Text: ${po.spellCheck.total_words} words, all correct`);
                }
            }
        }
    }
    catch (err) {
        console.error('Pipeline failed:', err.message);
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=cli.js.map