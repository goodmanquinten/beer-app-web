"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockProvider = void 0;
const sharp_1 = __importDefault(require("sharp"));
/**
 * MockProvider generates a placeholder PNG for local dev.
 * Produces a colored rectangle with the container type label.
 */
class MockProvider {
    name = 'mock';
    async generate(req) {
        const size = 1024;
        const bgColor = req.container_type === 'can'
            ? { r: 180, g: 200, b: 220, alpha: 0.9 }
            : { r: 160, g: 180, b: 140, alpha: 0.9 };
        const label = `MOCK ${req.container_type.toUpperCase()}`;
        const svgOverlay = `
      <svg width="${size}" height="${size}">
        <rect x="312" y="100" width="400" height="824" rx="20" ry="20"
              fill="rgba(${bgColor.r},${bgColor.g},${bgColor.b},${bgColor.alpha})"
              stroke="#333" stroke-width="4"/>
        <text x="512" y="520" text-anchor="middle" font-size="36"
              font-family="Arial, sans-serif" fill="#333" font-weight="bold">
          ${label}
        </text>
        <text x="512" y="570" text-anchor="middle" font-size="18"
              font-family="Arial, sans-serif" fill="#666">
          placeholder render
        </text>
      </svg>`;
        const image_buffer = await (0, sharp_1.default)({
            create: {
                width: size,
                height: size,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        })
            .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
            .png()
            .toBuffer();
        return { image_buffer, provider_name: this.name };
    }
}
exports.MockProvider = MockProvider;
//# sourceMappingURL=mock.js.map