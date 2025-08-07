import { FastifyRequest, FastifyReply } from 'fastify';
import { getCorsConfig, isOriginAllowed } from '../config/cors';

// 获取CORS配置
const corsConfig = getCorsConfig();

// 设置CORS响应头
function setCorsHeaders(reply: FastifyReply, origin: string | undefined) {
  const allowedOrigin = isOriginAllowed(origin, corsConfig) ? origin : corsConfig.origins[0];
  
  reply.header('Access-Control-Allow-Origin', allowedOrigin);
  reply.header('Access-Control-Allow-Credentials', corsConfig.credentials.toString());
  reply.header('Access-Control-Allow-Methods', corsConfig.methods.join(','));
  reply.header('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(','));
  reply.header('Access-Control-Max-Age', corsConfig.maxAge.toString());
}

// CORS中间件
export async function corsMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const origin = request.headers.origin;
  
  // 记录CORS相关信息
  console.log(`🔍 CORS检查 - Origin: ${origin}`);
  console.log(`🔍 允许的源:`, corsConfig.origins);
  console.log(`🔍 源是否允许: ${isOriginAllowed(origin, corsConfig)}`);
  
  // 处理预检请求 (OPTIONS)
  if (request.method === 'OPTIONS') {
    console.log('🔍 处理OPTIONS预检请求');
    
    if (!isOriginAllowed(origin, corsConfig)) {
      console.log('❌ 源不在白名单中，拒绝请求');
      return reply.status(403).send({
        error: 'CORS: Origin not allowed',
        allowedOrigins: corsConfig.origins
      });
    }
    
    setCorsHeaders(reply, origin);
    return reply.status(corsConfig.optionsSuccessStatus).send();
  }
  
  // 为实际请求添加CORS头
  setCorsHeaders(reply, origin);
}

// 创建CORS插件配置
export const corsPluginOptions = {
  origin: corsConfig.origins,
  methods: corsConfig.methods,
  allowedHeaders: corsConfig.allowedHeaders,
  credentials: corsConfig.credentials,
  maxAge: corsConfig.maxAge,
  preflightContinue: corsConfig.preflightContinue,
  optionsSuccessStatus: corsConfig.optionsSuccessStatus
};