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
exports.RealProvider = void 0;
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
const form_data_1 = __importDefault(require("form-data"));
/**
 * RealProvider sends the prompt + images to a configurable HTTP endpoint.
 * No vendor SDK required — just multipart/form-data over HTTP(S).
 *
 * Env vars:
 *   GENERATOR_ENDPOINT — full URL (required)
 *   GENERATOR_API_KEY  — optional auth header value
 */
class RealProvider {
    name = 'real';
    endpoint;
    apiKey;
    constructor() {
        const ep = process.env.GENERATOR_ENDPOINT;
        if (!ep) {
            throw new Error('RealProvider requires GENERATOR_ENDPOINT env var');
        }
        this.endpoint = ep;
        this.apiKey = process.env.GENERATOR_API_KEY;
    }
    async generate(req) {
        const form = new form_data_1.default();
        form.append('prompt', req.prompt);
        form.append('container_type', req.container_type);
        form.append('label_crop_image', fs.createReadStream(req.label_crop_path));
        if (req.template_path && fs.existsSync(req.template_path)) {
            form.append('template_image', fs.createReadStream(req.template_path));
        }
        const image_buffer = await this.postForm(form);
        return { image_buffer, provider_name: this.name };
    }
    postForm(form) {
        return new Promise((resolve, reject) => {
            const url = new url_1.URL(this.endpoint);
            const isHttps = url.protocol === 'https:';
            const transport = isHttps ? https : http;
            const headers = {
                ...form.getHeaders(),
            };
            if (this.apiKey) {
                headers['Authorization'] = `Bearer ${this.apiKey}`;
            }
            const reqOpts = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers,
            };
            const httpReq = transport.request(reqOpts, (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const body = Buffer.concat(chunks);
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(body);
                    }
                    else {
                        reject(new Error(`Provider returned HTTP ${res.statusCode}: ${body.toString('utf-8').slice(0, 500)}`));
                    }
                });
            });
            httpReq.on('error', reject);
            form.pipe(httpReq);
        });
    }
}
exports.RealProvider = RealProvider;
//# sourceMappingURL=real.js.map