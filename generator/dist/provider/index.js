"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = exports.TogetherProvider = exports.GeminiProvider = exports.RealProvider = exports.MockProvider = void 0;
exports.createProvider = createProvider;
exports.parseProviders = parseProviders;
var mock_1 = require("./mock");
Object.defineProperty(exports, "MockProvider", { enumerable: true, get: function () { return mock_1.MockProvider; } });
var real_1 = require("./real");
Object.defineProperty(exports, "RealProvider", { enumerable: true, get: function () { return real_1.RealProvider; } });
var gemini_1 = require("./gemini");
Object.defineProperty(exports, "GeminiProvider", { enumerable: true, get: function () { return gemini_1.GeminiProvider; } });
var together_1 = require("./together");
Object.defineProperty(exports, "TogetherProvider", { enumerable: true, get: function () { return together_1.TogetherProvider; } });
var openai_1 = require("./openai");
Object.defineProperty(exports, "OpenAIProvider", { enumerable: true, get: function () { return openai_1.OpenAIProvider; } });
function createProvider(name) {
    switch (name) {
        case 'mock':
            return new (require('./mock').MockProvider)();
        case 'gemini':
            return new (require('./gemini').GeminiProvider)();
        case 'together':
            return new (require('./together').TogetherProvider)();
        case 'openai':
            return new (require('./openai').OpenAIProvider)();
        case 'real':
            return new (require('./real').RealProvider)();
        default:
            throw new Error(`Unknown provider: ${name}`);
    }
}
const PROVIDER_NAMES = ['mock', 'gemini', 'together', 'openai', 'real'];
function parseProviders(input) {
    const names = input.split(',').map((s) => s.trim().toLowerCase());
    for (const n of names) {
        if (!PROVIDER_NAMES.includes(n)) {
            throw new Error(`Unknown provider "${n}". Available: ${PROVIDER_NAMES.join(', ')}`);
        }
    }
    return names;
}
//# sourceMappingURL=index.js.map