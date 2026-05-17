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
import { appConfig, databaseConfig } from './config';
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

    // 业务模块
    AuthModule,
    DocumentModule,
    AssociationModule,
    ExportModule,
    SettingsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
