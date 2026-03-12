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
exports.TogetherProvider = void 0;
const https = __importStar(require("https"));
const TOGETHER_URL = 'https://api.together.xyz/v1/images/generations';
const FLUX_MODEL = 'black-forest-labs/FLUX.1-schnell';
/**
 * TogetherProvider uses Together AI's free Flux Schnell model.
 * Text-to-image only (no reference image input on this model).
 * Requires TOGETHER_API_KEY env var.
 */
class TogetherProvider {
    name = 'together';
    apiKey;
    constructor() {
        const key = process.env.TOGETHER_API_KEY;
        if (!key) {
            throw new Error('TogetherProvider requires TOGETHER_API_KEY env var');
        }
        this.apiKey = key;
    }
    async generate(req) {
        const body = JSON.stringify({
            model: FLUX_MODEL,
            prompt: req.prompt,
            width: 1024,
            height: 1024,
            steps: 4,
            n: 1,
            response_format: 'base64',
        });
        const responseBody = await this.post(body);
        const parsed = JSON.parse(responseBody);
        if (!parsed.data || parsed.data.length === 0) {
            throw new Error(`Together AI returned no data: ${JSON.stringify(parsed).slice(0, 500)}`);
        }
        const b64 = parsed.data[0].b64_json;
        if (!b64) {
            // Fallback: if URL format returned, fetch the image
            const url = parsed.data[0].url;
            if (url) {
                const image_buffer = await this.fetchImage(url);
                return { image_buffer, provider_name: this.name };
            }
            throw new Error(`Together AI response has no image data: ${JSON.stringify(parsed.data[0]).slice(0, 300)}`);
        }
        const image_buffer = Buffer.from(b64, 'base64');
        return { image_buffer, provider_name: this.name };
    }
    post(body) {
        return new Promise((resolve, reject) => {
            const parsed = new URL(TOGETHER_URL);
            const reqOpts = {
                hostname: parsed.hostname,
                path: parsed.pathname,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
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
                        reject(new Error(`Together AI HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
                    }
                });
            });
            httpReq.on('error', reject);
            httpReq.write(body);
            httpReq.end();
        });
    }
    fetchImage(url) {
        return new Promise((resolve, reject) => {
            https.get(url, (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        });
    }
}
exports.TogetherProvider = TogetherProvider;
//# sourceMappingURL=together.js.map