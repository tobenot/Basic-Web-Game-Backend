import { getCorsConfig, isOriginAllowed } from '../config/cors';

// CORS测试工具
export class CorsTester {
  private corsConfig = getCorsConfig();

  // 测试特定源的CORS配置
  testOrigin(origin: string): {
    allowed: boolean;
    config: any;
    details: string[];
  } {
    const details: string[] = [];
    const allowed = isOriginAllowed(origin, this.corsConfig);
    
    details.push(`测试源: ${origin}`);
    details.push(`是否允许: ${allowed ? '✅ 是' : '❌ 否'}`);
    details.push(`CORS启用状态: ${this.corsConfig.enabled ? '✅ 启用' : '❌ 禁用'}`);
    details.push(`环境: ${process.env.NODE_ENV || 'development'}`);
    details.push(`允许的源列表:`);
    this.corsConfig.origins.forEach((orig, index) => {
      details.push(`  ${index + 1}. ${orig}`);
    });
    
    return {
      allowed,
      config: this.corsConfig,
      details
    };
  }

  // 打印完整的CORS配置信息
  printConfig(): void {
    console.log('🔧 CORS配置详情:');
    console.log('='.repeat(50));
    console.log(`启用状态: ${this.corsConfig.enabled ? '✅ 启用' : '❌ 禁用'}`);
    console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`最大缓存时间: ${this.corsConfig.maxAge}秒`);
    console.log(`允许的方法: ${this.corsConfig.methods.join(', ')}`);
    console.log(`允许的头部: ${this.corsConfig.allowedHeaders.join(', ')}`);
    console.log(`支持凭据: ${this.corsConfig.credentials ? '是' : '否'}`);
    console.log('允许的源:');
    this.corsConfig.origins.forEach((origin, index) => {
      console.log(`  ${index + 1}. ${origin}`);
    });
    console.log('='.repeat(50));
  }

  // 测试常见的前端源
  testCommonOrigins(): void {
    console.log('🧪 测试常见前端源:');
    console.log('='.repeat(50));
    
    const commonOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'https://tobenot.top',
      'https://bwb.tobenot.top',
      'https://invalid-domain.com',
    ];

    commonOrigins.forEach(origin => {
      const result = this.testOrigin(origin);
      console.log(`${result.allowed ? '✅' : '❌'} ${origin}`);
    });
    
    console.log('='.repeat(50));
  }
}

// 导出测试函数
export function testCors(origin?: string): void {
  const tester = new CorsTester();
  
  if (origin) {
    const result = tester.testOrigin(origin);
    console.log('🧪 CORS测试结果:');
    result.details.forEach(detail => console.log(detail));
  } else {
    tester.printConfig();
    tester.testCommonOrigins();
  }
}