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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.preprocessImage = preprocessImage;
exports.cropLabel = cropLabel;
const sharp_1 = __importDefault(require("sharp"));
const path = __importStar(require("path"));
const MAX_PREPROCESS_PX = 1600;
/**
 * Resize the input image so the longest edge is at most MAX_PREPROCESS_PX.
 * Returns the path to the resized image (written to outDir).
 */
async function preprocessImage(inputPath, outDir) {
    const meta = await (0, sharp_1.default)(inputPath).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w === 0 || h === 0) {
        throw new Error(`Cannot read dimensions of ${inputPath}`);
    }
    const longest = Math.max(w, h);
    const outPath = path.join(outDir, '_preprocessed.png');
    if (longest > MAX_PREPROCESS_PX) {
        await (0, sharp_1.default)(inputPath)
            .resize({ width: w >= h ? MAX_PREPROCESS_PX : undefined, height: h > w ? MAX_PREPROCESS_PX : undefined, fit: 'inside' })
            .png()
            .toFile(outPath);
    }
    else {
        await (0, sharp_1.default)(inputPath).png().toFile(outPath);
    }
    return outPath;
}
/**
 * Crop the center portion of the image for label extraction.
 * Uses configurable ratios for width and height.
 */
async function cropLabel(preprocessedPath, outDir, config) {
    const meta = await (0, sharp_1.default)(preprocessedPath).metadata();
    const w = meta.width;
    const h = meta.height;
    const cropW = Math.round(w * config.width_ratio);
    const cropH = Math.round(h * config.height_ratio);
    const left = Math.round((w - cropW) / 2);
    const top = Math.round((h - cropH) / 2);
    const outPath = path.join(outDir, '_labelcrop.png');
    await (0, sharp_1.default)(preprocessedPath)
        .extract({ left, top, width: cropW, height: cropH })
        .png()
        .toFile(outPath);
    return outPath;
}
//# sourceMappingURL=crop.js.map