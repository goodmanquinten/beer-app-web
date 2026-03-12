"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPrompt = buildPrompt;
exports.buildDetailedPrompt = buildDetailedPrompt;
function buildPrompt(stylePack, spec, hasTemplate) {
    const { knobs } = spec;
    const parts = [];
    const containerLabel = spec.container_type === 'can' ? '12oz aluminum beer can' : 'longneck glass beer bottle';
    const topColors = spec.palette.slice(0, 3).map((c) => c.hex).join(', ');
    // 1) Strong visual opening — what it IS, not what it isn't
    if (spec.identity.brand_name) {
        parts.push(`A polished, high-quality cartoon illustration of a ${spec.identity.brand_name} ${containerLabel}. Short and chunky proportions — noticeably wider and squatter than a real can. Glossy and vibrant with rich cel-shading — multiple visible color bands wrapping the cylinder from a bright specular highlight on the left through the true label color to a deep shadow on the right edge. Small sharp glints of reflected light on the body. Extra-thick bold outlines around the silhouette. Transparent background.`);
    }
    else {
        parts.push(`A polished, high-quality cartoon illustration of a ${containerLabel}, reproducing the exact beer shown in the reference image. Short and chunky proportions — noticeably wider and squatter than a real can. Glossy and vibrant with rich cel-shading — multiple visible color bands wrapping the cylinder from a bright specular highlight on the left through the true label color to a deep shadow on the right edge. Small sharp glints of reflected light on the body. Extra-thick bold outlines around the silhouette. Transparent background.`);
    }
    // 2) Label design — what to reproduce
    if (spec.identity.brand_name) {
        parts.push(`Faithfully reproduce the real ${spec.identity.brand_name} label: the logo, crest, color zones, and decorative elements that make it recognizable. The dominant label colors are ${topColors} — use only these colors and their natural light/shadow variants for shading. Silver/gray metallic lid and rims. No drop shadow.`);
    }
    else {
        parts.push(`Read the brand name from the reference image and spell it correctly. Faithfully reproduce the label: the logo, crest, color zones, and decorative elements from the reference. The dominant label colors are ${topColors} — use only these colors and their natural light/shadow variants. Do not add gold, extra metallic accents, or colors not present in the reference. Silver/gray metallic lid and rims. No drop shadow.`);
    }
    // 3) Text handling — simple and clear
    parts.push('SPELLING IS CRITICAL: The brand name must be spelled EXACTLY as it appears on the real product. Double-check every letter. For small text on the label: if you can spell it correctly, include it. If not, replace it with thin decorative lines in the same color. The main brand name must be large, clear, and correctly spelled. Do NOT invent or guess text — only render text you can read from the reference.');
    // 4) Template
    if (hasTemplate) {
        parts.push('A template reference is provided — match its can shape, viewing angle, and shading style. Only change the label artwork.');
    }
    // 5) Framing — CRITICAL
    parts.push('FRAMING IS CRITICAL: The ENTIRE can must be fully visible — lid, body, and base. NOTHING cropped or cut off at ANY edge. Leave generous padding on all four sides. The top of the lid and the bottom of the base must have clear space above and below them.');
    // 6) Brief negative — don't overdo it
    parts.push('No background. No photorealism. No brush texture. No added decorations not in the reference. No drop shadow.');
    return parts.join('\n\n');
}
/**
 * Detailed structured prompt for multimodal models that can see reference images.
 */
function buildDetailedPrompt(stylePack, spec, hasTemplate) {
    const { knobs } = spec;
    const lines = [];
    lines.push('=== STYLE GUIDE ===');
    lines.push(stylePack.global);
    lines.push('');
    lines.push('=== CONTAINER STYLE ===');
    lines.push(stylePack.container);
    lines.push('');
    lines.push('=== RENDERING CONSTRAINTS ===');
    lines.push(`- Output size: ${knobs.output_size}x${knobs.output_size} pixels, transparent PNG`);
    lines.push(`- Outline thickness: ${knobs.outline.thickness}`);
    lines.push(`- Shading mode: ${knobs.shading.mode}, ${knobs.shading.bands} bands`);
    lines.push(`- Pose: ${knobs.pose}`);
    lines.push(`- Key light: ${knobs.lighting.key}`);
    lines.push(`- Rim light: ${knobs.lighting.rim}`);
    lines.push(`- Shadow: ${knobs.lighting.shadow}`);
    lines.push('');
    lines.push('=== BRAND PALETTE ===');
    lines.push(`Container type: ${spec.container_type}`);
    lines.push('Dominant colors:');
    for (const c of spec.palette) {
        lines.push(`  ${c.hex} (weight: ${c.weight})`);
    }
    lines.push('');
    if (spec.identity.brand_name) {
        lines.push('=== BRAND IDENTITY ===');
        lines.push(`Brand: ${spec.identity.brand_name}`);
        if (spec.identity.variant_name)
            lines.push(`Variant: ${spec.identity.variant_name}`);
        lines.push('Reproduce the real label design in cartoon style.');
        lines.push('');
    }
    if (hasTemplate) {
        lines.push('=== TEMPLATE REFERENCE ===');
        lines.push('Match the overall can/bottle silhouette, pose, lighting, and shading to the provided template reference.');
        lines.push('');
    }
    lines.push('=== NEGATIVE (DO NOT INCLUDE) ===');
    lines.push(stylePack.negative);
    return lines.join('\n');
}
//# sourceMappingURL=promptBuilder.js.map