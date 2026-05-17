/**
 * 应用启动入口文件
 *
 * 用途：创建 NestJS 应用实例并配置全局中间件和插件。
 * 配置内容包括：
 * - 全局异常过滤器（统一错误响应格式）
 * - 全局验证管道（自动校验请求参数）
 * - CORS 跨域策略（仅允许配置的前端域名访问）
 * - Helmet 安全头（防止常见 Web 攻击）
 * - Swagger API 文档（自动生成 OpenAPI 3.0 文档）
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters';

/**
 * 应用启动函数
 * @description 初始化 NestJS 应用，配置全局中间件，启动 HTTP 服务
 */
async function bootstrap(): Promise<void> {
  // 创建 NestJS 应用实例
  const app = await NestFactory.create(AppModule);

  // 获取配置服务，用于读取环境变量
  const configService = app.get(ConfigService);

  // ============================================
  // 1. 配置 Helmet 安全头
  // Helmet 会自动设置多个 HTTP 响应头来防止常见攻击：
  // - X-Content-Type-Options: 防止 MIME 类型嗅探
  // - X-Frame-Options: 防止点击劫持
  // - X-XSS-Protection: 防止 XSS 攻击
  // ============================================
  app.use(helmet());

  // ============================================
  // 2. 配置 CORS 跨域策略
  // 为什么需要 CORS？浏览器的同源策略会阻止前端（如 localhost:5173）
  // 访问不同端口的后端（如 localhost:3000），CORS 配置允许指定的前端域名跨域访问
  // ============================================
  const corsOrigins = configService.get<string[]>('app.corsOrigins') || [
    'http://localhost:5173',
  ];
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // ============================================
  // 3. 配置全局异常过滤器
  // 捕获所有未处理的异常，转换为统一的 { code, message, details? } 格式
  // ============================================
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ============================================
  // 4. 配置全局验证管道
  // ValidationPipe 会自动使用 class-validator 装饰器校验请求体
  // - whitelist: true 表示自动剥离 DTO 中未定义的属性（防止恶意注入额外字段）
  // - forbidNonWhitelisted: true 表示如果请求体包含未定义的属性，直接返回 400 错误
  // - transform: true 表示自动将请求体转换为 DTO 类的实例（支持类型转换）
  // ============================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ============================================
  // 5. 配置全局路由前缀
  // 所有 API 路径都以 /api 开头，如 /api/auth/login、/api/documents 等
  // ============================================
  app.setGlobalPrefix('api');

  // ============================================
  // 6. 配置 Swagger API 文档
  // Swagger 会自动扫描所有控制器和 DTO，生成 OpenAPI 3.0 规范文档
  // 访问 http://localhost:3000/api-docs 可以查看交互式 API 文档
  // ============================================
  const swaggerConfig = new DocumentBuilder()
    .setTitle('英文联想编辑器 API')
    .setDescription(
      '英文联想编辑器后端 API 文档 - 提供认证、文档管理、联想翻译、导出、设置等功能',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: '输入 JWT 令牌进行认证',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  // 将 Swagger UI 挂载到 /api-docs 路径
  SwaggerModule.setup('api-docs', app, document);

  // ============================================
  // 7. 启动 HTTP 服务
  // ============================================
  const port = configService.get<number>('app.port') || 3000;
  await app.listen(port);

  // 输出启动信息
  console.log(`🚀 应用已启动: http://localhost:${port}`);
  console.log(`📖 API 文档: http://localhost:${port}/api-docs`);
}

// 调用启动函数
bootstrap();
