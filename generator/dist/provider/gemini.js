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
exports.GeminiProvider = void 0;
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const GEMINI_MODEL = 'gemini-2.5-flash-image';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
/**
 * GeminiProvider uses Google's Gemini API for image generation.
 * Sends prompt text + label crop as inline base64 image.
 * Requires GOOGLE_API_KEY env var.
 */
class GeminiProvider {
    name = 'gemini';
    apiKey;
    constructor() {
        const key = process.env.GOOGLE_API_KEY;
        if (!key) {
            throw new Error('GeminiProvider requires GOOGLE_API_KEY env var');
        }
        this.apiKey = key;
    }
    async generate(req) {
        const labelCropBase64 = fs.readFileSync(req.label_crop_path).toString('base64');
        const parts = [
            { text: req.prompt },
            {
                inline_data: {
                    mime_type: 'image/png',
                    data: labelCropBase64,
                },
            },
        ];
        // Add template if present
        if (req.template_path && fs.existsSync(req.template_path)) {
            const templateBase64 = fs.readFileSync(req.template_path).toString('base64');
            parts.push({
                inline_data: {
                    mime_type: 'image/png',
                    data: templateBase64,
                },
            });
        }
        const body = JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                    aspectRatio: '1:1',
                },
            },
        });
        const responseBody = await this.post(body);
        const parsed = JSON.parse(responseBody);
        // Extract image from response
        const candidates = parsed.candidates;
        if (!candidates || candidates.length === 0) {
            throw new Error(`Gemini returned no candidates: ${JSON.stringify(parsed).slice(0, 500)}`);
        }
        const responseParts = candidates[0].content?.parts;
        if (!responseParts) {
            throw new Error(`Gemini returned no parts: ${JSON.stringify(parsed).slice(0, 500)}`);
        }
        for (const part of responseParts) {
            if (part.inline_data?.data) {
                const image_buffer = Buffer.from(part.inline_data.data, 'base64');
                return { image_buffer, provider_name: this.name };
            }
        }
        throw new Error(`Gemini response contained no image data. Parts: ${JSON.stringify(responseParts.map((p) => Object.keys(p))).slice(0, 300)}`);
    }
    post(body) {
        const url = `${GEMINI_URL}?key=${this.apiKey}`;
        return new Promise((resolve, reject) => {
            const parsed = new URL(url);
            const reqOpts = {
                hostname: parsed.hostname,
                path: parsed.pathname + parsed.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            };
            const httpReq = https.request(reqOpts, (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const data = Buffer.concat(chunks).toString('utf-8');
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    }
                    else {
                        reject(new Error(`Gemini HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
                    }
                });
            });
            httpReq.on('error', reject);
            httpReq.write(body);
            httpReq.end();
        });
    }
}
exports.GeminiProvider = GeminiProvider;
//# sourceMappingURL=gemini.js.map