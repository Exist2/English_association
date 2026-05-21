/**
 * Redis 模块
 *
 * 用途：提供 Redis 客户端的全局注入能力。
 * 其他模块（如 AuthService）可以通过 @Inject('REDIS_CLIENT') 获取 Redis 实例，
 * 用于存储短信验证码、登录尝试记录等需要自动过期的临时数据。
 *
 * 为什么用 Redis 而不是 MySQL？
 * - 验证码和登录尝试记录都有过期时间（TTL），Redis 原生支持 key 自动过期
 * - Redis 是内存数据库，读写速度远快于 MySQL，适合高频访问的临时数据
 * - 避免在 MySQL 中存储大量临时数据，减少数据库压力
 */
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * Redis 注入令牌
 * 在 Service 中通过 @Inject(REDIS_CLIENT) 注入 Redis 实例
 */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Redis 全局模块
 * @description 使用 @Global() 装饰器使其在所有模块中可用，无需重复导入
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      /**
       * 工厂函数：根据环境变量创建 Redis 连接实例
       * useFactory 允许我们注入 ConfigService 来读取配置
       */
      useFactory: (configService: ConfigService): Redis => {
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);
        const password = configService.get<string>('REDIS_PASSWORD', '');

        return new Redis({
          host,
          port,
          password: password || undefined,
          // 连接失败时的重试策略：每次等待时间递增，最多等待 3 秒
          retryStrategy: (times: number) => Math.min(times * 200, 3000),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
