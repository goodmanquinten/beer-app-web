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
exports.buildGridHtml = buildGridHtml;
const path = __importStar(require("path"));
function toRelative(from, to) {
    return path.relative(from, to).replace(/\\/g, '/');
}
function paletteSwatches(result) {
    return result.spec.palette
        .map((c) => `<span style="display:inline-block;width:28px;height:28px;background:${c.hex};border:1px solid #333;border-radius:4px;margin-right:3px;" title="${c.hex} (${c.weight})"></span>`)
        .join('');
}
function badge(passed) {
    const bg = passed ? '#2d8a4e' : '#c0392b';
    const label = passed ? 'PASS' : 'FAIL';
    return `<span style="background:${bg};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;">${label}</span>`;
}
function buildGridHtml(entries, outputDir) {
    const rows = entries
        .map((entry) => {
        if (!entry.result) {
            return `
        <tr>
          <td>${entry.basename}</td>
          <td colspan="6" style="color:#c0392b;">ERROR: ${entry.error ?? 'unknown'}</td>
        </tr>`;
        }
        const r = entry.result;
        const inputThumb = toRelative(outputDir, entry.inputPath);
        const labelCrop = toRelative(outputDir, r.outputs.labelcrop_png);
        const promptLink = toRelative(outputDir, r.outputs.prompt_txt);
        const specLink = toRelative(outputDir, r.outputs.spec_json);
        // Render columns — one per provider
        const renderCells = r.providerOutputs
            .map((po) => {
            if (!po.render_png) {
                return `<td style="color:#c0392b;font-size:12px;">${po.provider_name}: failed<br><small>${po.validation.issues.join('<br>')}</small></td>`;
            }
            const renderSrc = toRelative(outputDir, po.render_png);
            const reportLink = toRelative(outputDir, po.report_json);
            return `<td>
            <div style="font-weight:bold;font-size:12px;margin-bottom:4px;">${po.provider_name}</div>
            <img src="${renderSrc}" alt="${po.provider_name} render" style="max-width:180px;max-height:180px;background:#eee;">
            <div style="margin-top:4px;">${badge(po.validation.passed)}</div>
            ${po.validation.issues.length > 0 ? '<small>' + po.validation.issues.join('<br>') + '</small>' : ''}
            <div style="margin-top:4px;"><a href="${reportLink}" style="font-size:11px;">report</a></div>
          </td>`;
        })
            .join('\n');
        return `
        <tr>
          <td><img src="${inputThumb}" alt="${entry.basename}" style="max-width:120px;max-height:120px;"></td>
          <td><img src="${labelCrop}" alt="label crop" style="max-width:120px;max-height:120px;"></td>
          ${renderCells}
          <td>${paletteSwatches(r)}</td>
          <td>
            <a href="${promptLink}">prompt</a> |
            <a href="${specLink}">spec</a>
          </td>
        </tr>`;
    })
        .join('\n');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Generator Batch Results</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: #f5f5f5; }
    h1 { margin-bottom: 16px; }
    table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; vertical-align: middle; }
    th { background: #333; color: #fff; }
    tr:hover { background: #fafafa; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    img { border-radius: 4px; }
    small { color: #888; display: block; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>Generator Batch Results</h1>
  <p style="margin-bottom:16px;color:#666;">Generated ${new Date().toISOString()}</p>
  <table>
    <thead>
      <tr>
        <th>Input</th>
        <th>Label Crop</th>
        <th colspan="3">Renders (per provider)</th>
        <th>Palette</th>
        <th>Files</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}
//# sourceMappingURL=gridHtml.js.map