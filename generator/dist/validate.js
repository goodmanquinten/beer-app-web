"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateRender = validateRender;
const sharp_1 = __importDefault(require("sharp"));
/**
 * Validate the generated render image.
 * - Must have alpha channel (transparency present)
 * - Must be square at the target size
 * - Container should be roughly centered (non-transparent bounding box within 10% margins)
 */
async function validateRender(renderBuffer, targetSize) {
    const issues = [];
    // Ensure we have the right size
    let img = (0, sharp_1.default)(renderBuffer);
    const meta = await img.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    const is_square = w === h;
    const is_target_size = w === targetSize && h === targetSize;
    if (!is_square || !is_target_size) {
        issues.push(`Image is ${w}x${h}, resizing to ${targetSize}x${targetSize}`);
        img = (0, sharp_1.default)(renderBuffer).resize(targetSize, targetSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
    }
    const resizedBuffer = await img.ensureAlpha().png().toBuffer();
    const resizedMeta = await (0, sharp_1.default)(resizedBuffer).metadata();
    // Check transparency
    const has_transparency = (resizedMeta.channels ?? 0) >= 4;
    if (!has_transparency) {
        issues.push('No alpha channel detected');
    }
    // Find non-transparent bounding box
    const { data, info } = await (0, sharp_1.default)(resizedBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true });
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
    const channels = info.channels;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * channels;
            const alpha = data[idx + channels - 1];
            if (alpha > 10) {
                if (x < minX)
                    minX = x;
                if (x > maxX)
                    maxX = x;
                if (y < minY)
                    minY = y;
                if (y > maxY)
                    maxY = y;
            }
        }
    }
    let bbox = null;
    let is_centered = false;
    let is_cropped = false;
    if (maxX > minX && maxY > minY) {
        bbox = { left: minX, top: minY, right: maxX, bottom: maxY };
        const margin = Math.round(targetSize * 0.10);
        is_centered = minX >= margin && minY >= margin &&
            maxX <= targetSize - margin && maxY <= targetSize - margin;
        if (!is_centered) {
            issues.push(`Content bbox (${minX},${minY})-(${maxX},${maxY}) is not within 10% margins (${margin}px)`);
        }
        // Check if content touches the edges — indicates cropping
        const edgeThreshold = 3; // pixels from edge
        const touchesTop = minY <= edgeThreshold;
        const touchesBottom = maxY >= targetSize - edgeThreshold;
        const touchesLeft = minX <= edgeThreshold;
        const touchesRight = maxX >= targetSize - edgeThreshold;
        if (touchesTop || touchesBottom || touchesLeft || touchesRight) {
            is_cropped = true;
            const edges = [];
            if (touchesTop)
                edges.push('top');
            if (touchesBottom)
                edges.push('bottom');
            if (touchesLeft)
                edges.push('left');
            if (touchesRight)
                edges.push('right');
            issues.push(`CROPPED: content touches ${edges.join(', ')} edge(s) — can/bottle may be cut off`);
        }
    }
    else {
        issues.push('Image appears fully transparent — no content detected');
    }
    // Auto-fix: if content is too close to edges, scale down and re-center with padding
    let finalBuffer = resizedBuffer;
    if (bbox && (maxX - minX > 0) && (maxY - minY > 0)) {
        const padding = Math.round(targetSize * 0.08); // 8% padding on each side
        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const availW = targetSize - padding * 2;
        const availH = targetSize - padding * 2;
        // Only re-pad if content is too close to any edge
        const needsPadding = minX < padding || minY < padding ||
            maxX > targetSize - padding || maxY > targetSize - padding;
        if (needsPadding) {
            const scale = Math.min(availW / contentW, availH / contentH, 1.0);
            if (scale < 1.0) {
                // Extract content, scale down, and place centered
                const cropped = await (0, sharp_1.default)(resizedBuffer)
                    .extract({ left: minX, top: minY, width: contentW, height: contentH })
                    .resize(Math.round(contentW * scale), Math.round(contentH * scale), { fit: 'inside' })
                    .png()
                    .toBuffer();
                const croppedMeta = await (0, sharp_1.default)(cropped).metadata();
                const newW = croppedMeta.width ?? 0;
                const newH = croppedMeta.height ?? 0;
                const offsetX = Math.round((targetSize - newW) / 2);
                const offsetY = Math.round((targetSize - newH) / 2);
                finalBuffer = await (0, sharp_1.default)({
                    create: { width: targetSize, height: targetSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
                })
                    .composite([{ input: cropped, left: offsetX, top: offsetY }])
                    .png()
                    .toBuffer();
                issues.push(`Auto-padded: scaled to ${Math.round(scale * 100)}% and re-centered`);
                is_cropped = false;
            }
        }
    }
    const passed = has_transparency && is_centered && !is_cropped && issues.length === 0;
    return {
        validated: finalBuffer,
        result: {
            has_transparency,
            is_square: true,
            is_target_size: true,
            is_centered,
            is_cropped,
            bbox,
            passed,
            issues,
        },
    };
}
//# sourceMappingURL=validate.js.map