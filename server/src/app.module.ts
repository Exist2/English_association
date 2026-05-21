/**
 * 应用根模块
 *
 * 用途：NestJS 应用的入口模块，负责组装所有子模块和全局配置。
 * 这里配置了：
 * - ConfigModule：环境变量管理（从 .env 文件读取配置）
 * - TypeOrmModule：MySQL 数据库连接
 * - ThrottlerModule：请求频率限制（防止恶意刷接口）
 * - 各业务模块（认证、文档、联想、导出、设置）
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { appConfig, databaseConfig } from './config';
import { CustomThrottlerGuard, JwtAuthGuard } from './common/guards';
import { RedisModule } from './common/redis';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentModule } from './modules/document/document.module';
import { AssociationModule } from './modules/association/association.module';
import { ExportModule } from './modules/export/export.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    /**
     * ConfigModule.forRoot() 加载环境变量
     * - isGlobal: true 表示所有模块都可以直接注入 ConfigService，无需再次导入 ConfigModule
     * - envFilePath: 指定 .env 文件路径
     * - load: 加载自定义配置工厂函数（app.config.ts 和 database.config.ts）
     */
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [appConfig, databaseConfig],
    }),

    /**
     * TypeOrmModule.forRootAsync() 异步配置数据库连接
     * 为什么用 forRootAsync？因为需要从 ConfigService 中读取配置，而 ConfigService 需要等 ConfigModule 初始化完成
     */
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        // autoLoadEntities: true 表示自动加载通过 TypeOrmModule.forFeature() 注册的实体
        autoLoadEntities: true,
        // synchronize: true 仅用于开发环境，会自动根据实体定义创建/更新数据库表结构
        // 生产环境必须设为 false，使用 migration 管理数据库变更
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),

    /**
     * ThrottlerModule 请求频率限制
     * - ttl: 60000 毫秒（1分钟）内
     * - limit: 同一 IP 最多 100 次请求
     * 超过限制会返回 429 Too Many Requests
     */
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    /**
     * RedisModule 提供全局 Redis 客户端
     * 用于验证码存储、登录尝试记录等需要自动过期的临时数据
     */
    RedisModule,

    // 业务模块
    AuthModule,
    DocumentModule,
    AssociationModule,
    ExportModule,
    SettingsModule,
  ],
  controllers: [],
  providers: [
    /**
     * 全局注册自定义频率限制守卫
     * APP_GUARD 是 NestJS 提供的特殊 token，用于注册全局守卫
     * 这样所有路由都会自动受到频率限制保护，无需在每个控制器上单独添加
     */
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
    /**
     * 全局注册 JWT 认证守卫
     * 所有路由默认需要 JWT 认证，使用 @Public() 装饰器标记的路由除外
     * 执行顺序：ThrottlerGuard → JwtAuthGuard → 控制器方法
     */
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
