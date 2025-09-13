import { config } from '../config';

// CORS配置类型
export interface CorsConfig {
  enabled: boolean;
  origins: string[];
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

// 获取CORS配置
export function getCorsConfig(): CorsConfig {
  const isProduction = config.isProduction;
  const corsProvider = (process.env.CORS_PROVIDER || '').trim();
  
  // 基础允许的源
  const baseOrigins = [
    config.frontend.localDev,
    config.backend.localDev,
    config.frontend.production,
    config.backend.production,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'https://tobenot.top',
    'https://bwb.tobenot.top',
    'https://html-classic.itch.zone',
    'https://itch.zone',
  ];

  // 从环境变量添加额外的CORS域名
  const additionalOrigins = process.env.CORS_ADDITIONAL_ORIGINS;
  if (additionalOrigins) {
    baseOrigins.push(...additionalOrigins.split(',').map(origin => origin.trim()));
  }

  // 根据环境过滤源
  const origins = isProduction 
    ? baseOrigins.filter(origin => origin.startsWith('https://'))
    : baseOrigins;

  const enabled = (process.env.CORS_ENABLED !== 'false') && !(isProduction && corsProvider === 'NGINX');

  return {
    enabled,
    origins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'x-trpc-source', 
      'X-Requested-With', 
      'Accept',
      'Origin',
      'x-api-key',
      'x-goog-api-key',
      'x-feature-password'
    ],
    credentials: true,
    maxAge: Number(process.env.CORS_MAX_AGE) || 86400, // 默认24小时
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
}

// 验证源是否允许
export function isOriginAllowed(origin: string | undefined, corsConfig: CorsConfig): boolean {
  if (!origin) return false;
  return corsConfig.origins.includes(origin);
}

// 获取允许的源字符串（用于调试）
export function getOriginsString(corsConfig: CorsConfig): string {
  return corsConfig.origins.join(', ');
}