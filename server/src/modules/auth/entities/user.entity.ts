/**
 * User 实体（用户表）
 *
 * 用途：存储用户的基本信息。手机号是用户的唯一标识，但为了安全：
 * - phone_encrypted：使用 AES 加密存储手机号原文，需要时可以解密还原
 * - phone_hash：使用 SHA-256 哈希存储，用于数据库查询（哈希值不可逆，但可以快速比对）
 *
 * 为什么要这样设计？
 * 直接存储明文手机号有泄露风险。加密存储保证即使数据库被攻破，攻击者也无法直接获取手机号。
 * 哈希字段用于查询，因为加密后的值每次可能不同（取决于加密模式），无法直接用于 WHERE 条件。
 *
 * 关于属性后面的 `!` 符号：
 * TypeScript 严格模式要求属性必须在构造函数中初始化。
 * 但 TypeORM 实体的属性是由框架在运行时自动赋值的（从数据库读取或通过 Repository.create()），
 * 所以我们用 `!`（确定赋值断言）告诉 TypeScript："这个属性一定会被赋值，不用担心"。
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 用户实体类
 * @description 对应数据库 users 表，存储用户账户信息
 */
@Entity('users')
export class User {
  /**
   * 用户唯一标识
   * @description 使用 UUID v4 自动生成，避免自增 ID 被猜测
   * PrimaryGeneratedColumn('uuid') 会让 TypeORM 自动生成 UUID 作为主键
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * 加密后的手机号
   * @description 使用 AES 对称加密算法加密存储，需要查看原始手机号时可以解密
   * 长度 255 是因为加密后的字符串（Base64编码）会比原文长很多
   */
  @Column({ name: 'phone_encrypted', type: 'varchar', length: 255 })
  phoneEncrypted!: string;

  /**
   * 手机号的哈希值
   * @description 使用 SHA-256 算法生成的哈希值，用于数据库查询
   * unique: true 保证同一个手机号不能注册多个账户
   * 长度 64 是因为 SHA-256 输出固定为 64 个十六进制字符
   */
  @Column({ name: 'phone_hash', type: 'varchar', length: 64, unique: true })
  phoneHash!: string;

  /**
   * 账户创建时间
   * @description CreateDateColumn 装饰器会在插入记录时自动设置当前时间
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /**
   * 账户更新时间
   * @description UpdateDateColumn 装饰器会在每次更新记录时自动刷新为当前时间
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
