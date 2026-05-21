/**
 * 认证模块
 *
 * 用途：处理用户注册、登录、验证码发送与校验等认证相关功能。
 * 包含滑块验证码、短信验证码、JWT 令牌签发等子功能。
 *
 * 存储方案：
 * - User 实体：存储在 MySQL（持久化用户信息）
 * - 短信验证码：存储在 Redis（TTL 60秒自动过期）
 * - 登录尝试记录：存储在 Redis（TTL 15分钟自动过期）
 *
 * 依赖：
 * - TypeOrmModule：提供 User Repository
 * - JwtModule：提供 JWT 签发和验证能力
 * - RedisModule：提供 Redis 客户端（全局模块，无需显式导入）
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from './entities';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    /**
     * TypeOrmModule.forFeature() 注册本模块使用的实体
     * 注册后可以在本模块的 Service 中通过 @InjectRepository() 注入对应的 Repository
     * Repository 提供了 find、save、delete 等数据库操作方法
     *
     * 注意：只注册 User 实体，验证码和登录尝试记录使用 Redis 存储
     */
    TypeOrmModule.forFeature([User]),

    /**
     * JwtModule.registerAsync() 异步注册 JWT 模块
     * 为什么用 registerAsync？因为需要从 ConfigService 读取 JWT_SECRET 环境变量
     *
     * - secret：JWT 签名密钥，用于签发和验证令牌
     * - signOptions.expiresIn：令牌默认过期时间（7天 = 604800秒）
     *
     * 注意：使用数字（秒）而非字符串，避免 TypeScript 类型兼容问题
     */
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('app.jwtSecret'),
        signOptions: {
          expiresIn: 604800, // 7天 = 7 * 24 * 60 * 60 秒
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
