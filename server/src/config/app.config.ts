/**
 * 应用全局配置文件
 *
 * 用途：集中管理应用级别的配置项，如端口、JWT、CORS、加密密钥等。
 * 通过 registerAs('app') 注册，在代码中通过 configService.get('app.port') 访问。
 */
import { registerAs } from '@nestjs/config';

/**
 * 应用配置工厂函数
 * @description 注册为 'app' 命名空间，包含端口、JWT、CORS、加密等配置
 */
export default registerAs('app', () => ({
  /** 服务监听端口 */
  port: parseInt(process.env.PORT || '3000', 10),

  /** JWT 密钥，用于签发和验证令牌 */
  jwtSecret: process.env.JWT_SECRET || 'default_secret',

  /** JWT 过期时间，默认7天 */
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  /** CORS 允许的前端域名列表（从逗号分隔的字符串解析为数组） */
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim()),

  /** 加密密钥，用于手机号等敏感数据的加密存储 */
  encryptionKey: process.env.ENCRYPTION_KEY || 'default_key_32chars_long_here!',
}));
