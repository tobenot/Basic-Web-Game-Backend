"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const app_1 = require("../src/app");
let cached = null;
function handler(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            if (!cached) {
                cached = (0, app_1.buildServer)();
            }
            const server = yield cached;
            yield server.ready();
            // Fastify can handle Node's req/res directly via routing
            server.server.emit('request', req, res);
        }
        catch (err) {
            console.error('Serverless handler error:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}
