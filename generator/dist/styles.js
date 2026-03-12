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
exports.loadKnobs = loadKnobs;
exports.loadStylePack = loadStylePack;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const beerspec_1 = require("./beerspec");
function readMd(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Style file not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf-8').trim();
}
function loadKnobs(styleDir) {
    const knobsPath = path.join(styleDir, 'knobs.json');
    if (!fs.existsSync(knobsPath)) {
        console.warn(`knobs.json not found at ${knobsPath}, using defaults`);
        return { ...beerspec_1.DEFAULT_KNOBS };
    }
    const raw = JSON.parse(fs.readFileSync(knobsPath, 'utf-8'));
    return {
        output_size: raw.output_size ?? beerspec_1.DEFAULT_KNOBS.output_size,
        crop: { ...beerspec_1.DEFAULT_KNOBS.crop, ...raw.crop },
        outline: { ...beerspec_1.DEFAULT_KNOBS.outline, ...raw.outline },
        shading: { ...beerspec_1.DEFAULT_KNOBS.shading, ...raw.shading },
        pose: raw.pose ?? beerspec_1.DEFAULT_KNOBS.pose,
        lighting: { ...beerspec_1.DEFAULT_KNOBS.lighting, ...raw.lighting },
    };
}
function loadStylePack(styleVersion, containerType) {
    const styleDir = path.resolve(__dirname, '..', 'styles', styleVersion);
    if (!fs.existsSync(styleDir)) {
        throw new Error(`Style directory not found: ${styleDir}`);
    }
    const containerFile = containerType === 'can' ? 'can_style.md' : 'bottle_style.md';
    return {
        global: readMd(path.join(styleDir, 'global_style.md')),
        container: readMd(path.join(styleDir, containerFile)),
        negative: readMd(path.join(styleDir, 'negative.md')),
        knobs: loadKnobs(styleDir),
    };
}
//# sourceMappingURL=styles.js.map