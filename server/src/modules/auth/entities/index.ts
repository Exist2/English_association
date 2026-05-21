/**
 * Auth 模块实体导出文件
 *
 * 用途：统一导出认证模块下的所有实体类，方便其他模块引用。
 * 使用桶文件（barrel file）模式，避免多层路径导入。
 *
 * 注意：SmsCode 和 LoginAttempt 已改为 Redis 存储，不再使用 TypeORM 实体。
 */
export { User } from './user.entity';
