/**
 * Document 实体（文档表）
 *
 * 用途：存储用户创建的文档数据，包括标题和富文本内容。
 *
 * 设计要点：
 * - title：文档标题，长度限制 1-50 字符，用于历史记录列表显示
 * - content：富文本内容，使用 longtext 类型存储 JSON 格式的编辑器数据
 *   （Tiptap 编辑器会将内容序列化为 JSON 结构）
 * - user_id：关联用户，确保用户只能访问自己的文档
 *
 * 关系：
 * - 多对一关系：多个文档属于一个用户（ManyToOne）
 *
 * 关于 `!` 符号：TypeORM 在运行时自动赋值实体属性，`!` 告诉 TypeScript 编译器不用检查初始化。
 */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

/**
 * 文档实体类
 * @description 对应数据库 documents 表，存储用户的文档标题和富文本内容
 */
@Entity('documents')
export class Document {
  /**
   * 文档唯一标识
   * @description UUID 自动生成的主键
   */
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * 所属用户 ID
   * @description 外键，关联 users 表的 id 字段
   * 用于确保用户只能操作自己的文档（权限隔离）
   */
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  /**
   * 文档标题
   * @description 用户创建文档时输入的标题，长度 1-50 字符
   * 在历史记录列表中作为显示名称（超过20字符会截断显示）
   */
  @Column({ type: 'varchar', length: 50 })
  title!: string;

  /**
   * 文档富文本内容
   * @description 存储 Tiptap 编辑器序列化后的 JSON 内容
   * 使用 longtext 类型支持大文档（最大约 4GB）
   */
  @Column({ type: 'longtext' })
  content!: string;

  /**
   * 文档创建时间
   * @description 文档首次创建的时间，不会再变更
   */
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  /**
   * 文档最后更新时间
   * @description 每次保存文档时自动更新，用于历史记录列表的排序
   */
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  /**
   * 关联的用户实体
   * @description ManyToOne 表示"多个文档属于一个用户"的关系
   * JoinColumn 指定外键列名为 user_id
   * 通过这个关系，可以用 document.user 直接访问文档所属的用户对象
   */
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
