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
exports.OpenAIProvider = void 0;
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
/**
 * OpenAI provider using gpt-image-1.
 * Uses /images/edits when a label crop is available (sends the reference image).
 * Uses /images/generations as fallback.
 * Requires OPENAI_API_KEY env var.
 */
class OpenAIProvider {
    name = 'openai';
    apiKey;
    constructor() {
        const key = process.env.OPENAI_API_KEY;
        if (!key) {
            throw new Error('OpenAIProvider requires OPENAI_API_KEY env var');
        }
        this.apiKey = key;
    }
    async generate(req) {
        // Use /images/edits with the label crop as reference
        const hasLabelCrop = req.label_crop_path && fs.existsSync(req.label_crop_path);
        const hasTemplate = req.template_path && fs.existsSync(req.template_path);
        if (hasLabelCrop || hasTemplate) {
            return this.editWithReference(req);
        }
        return this.generateFromText(req);
    }
    async editWithReference(req) {
        const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
        const parts = [];
        const addField = (name, value) => {
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
        };
        const addFile = (name, filePath, filename) => {
            const content = fs.readFileSync(filePath);
            parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`));
            parts.push(content);
            parts.push(Buffer.from('\r\n'));
        };
        addField('model', 'gpt-image-1');
        addField('prompt', req.prompt);
        addField('size', '1024x1024');
        addField('quality', 'high');
        addField('background', 'transparent');
        // Send label crop as reference image
        if (req.label_crop_path && fs.existsSync(req.label_crop_path)) {
            addFile('image[]', req.label_crop_path, 'label_crop.png');
        }
        // Send template as second reference image
        if (req.template_path && fs.existsSync(req.template_path)) {
            addFile('image[]', req.template_path, 'template.png');
        }
        parts.push(Buffer.from(`--${boundary}--\r\n`));
        const body = Buffer.concat(parts);
        const responseBody = await this.post('/v1/images/edits', body, `multipart/form-data; boundary=${boundary}`);
        return this.parseResponse(responseBody);
    }
    async generateFromText(req) {
        const body = JSON.stringify({
            model: 'gpt-image-1',
            prompt: req.prompt,
            size: '1024x1024',
            quality: 'high',
            background: 'transparent',
        });
        const responseBody = await this.post('/v1/images/generations', Buffer.from(body), 'application/json');
        return this.parseResponse(responseBody);
    }
    parseResponse(responseBody) {
        const parsed = JSON.parse(responseBody);
        if (!parsed.data || parsed.data.length === 0) {
            throw new Error(`OpenAI returned no data: ${JSON.stringify(parsed).slice(0, 500)}`);
        }
        const item = parsed.data[0];
        // gpt-image-1 defaults to base64
        if (item.b64_json) {
            const image_buffer = Buffer.from(item.b64_json, 'base64');
            return { image_buffer, provider_name: this.name };
        }
        if (item.url) {
            // Shouldn't normally hit this path with gpt-image-1, but handle it
            throw new Error('OpenAI returned URL instead of base64 — set response_format to b64_json');
        }
        throw new Error(`OpenAI response has no image data: ${JSON.stringify(item).slice(0, 300)}`);
    }
    post(path, body, contentType) {
        return new Promise((resolve, reject) => {
            const reqOpts = {
                hostname: 'api.openai.com',
                path,
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': contentType,
                    'Content-Length': body.length,
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
                        reject(new Error(`OpenAI HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
                    }
                });
            });
            httpReq.on('error', reject);
            httpReq.write(body);
            httpReq.end();
        });
    }
}
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openai.js.map