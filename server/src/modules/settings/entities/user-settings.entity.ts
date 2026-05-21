/**
 * UserSettings 实体（用户设置表）
 *
 * 用途：存储用户的个性化配置，包括主题模式、字号大小、提示显示时长。
 *
 * 设计要点：
 * - 每个用户只有一条设置记录（OneToOne 关系，user_id 唯一）
 * - 新用户首次访问设置时，系统会创建一条默认配置记录
 * - 用户修改设置后自动持久化，下次登录时恢复
 *
 * 默认值：
 * - theme_mode: 'light'（明亮主题）
 * - font_size: 16（16px 字号）
 * - hint_duration: 5（提示显示5秒）
 *
 * 关于 `!` 符号：TypeORM 在运行时自动赋值实体属性，`!` 告诉 TypeScript 编译器不用检查初始化。
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

/**
 * 用户设置实体类
 * @description 对应数据库 user_settings 表，存储用户的主题和显示偏好配置
 */
@Entity('user_settings')
export class UserSettings {
  /**
   * 设置记录唯一标识
   * @description UUID 自动生成的主键
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * 所属用户 ID
   * @description 外键，关联 users 表的 id 字段
   * unique: true 保证每个用户只有一条设置记录
   */
  @Column({ name: 'user_id', type: 'varchar', length: 36, unique: true })
  userId!: string;

  /**
   * 主题模式
   * @description 'light' 表示明亮主题，'dark' 表示暗黑主题
   * 默认值为 'light'（明亮主题）
   */
  @Column({ name: 'theme_mode', type: 'varchar', length: 10, default: 'light' })
  themeMode!: string;

  /**
   * 编辑器字号大小
   * @description 有效范围 12-24（单位 px），步长为 1
   * 默认值为 16px
   */
  @Column({ name: 'font_size', type: 'int', default: 16 })
  fontSize!: number;

  /**
   * 提示显示时长
   * @description 联想提示在面板中显示的秒数，有效范围 3-30 秒，步长为 1
   * 默认值为 5 秒
   */
  @Column({ name: 'hint_duration', type: 'int', default: 5 })
  hintDuration!: number;

  /**
   * 设置最后更新时间
   * @description 每次用户修改设置时自动更新
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /**
   * 关联的用户实体
   * @description OneToOne 表示"一个用户对应一条设置记录"的关系
   * JoinColumn 指定外键列名为 user_id
   */
  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
