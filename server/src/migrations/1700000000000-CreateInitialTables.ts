/**
 * 初始数据库迁移脚本
 *
 * 用途：创建应用所需的所有 MySQL 数据库表。
 * 在生产环境中，不能使用 synchronize: true（会导致数据丢失），
 * 而是通过迁移脚本来管理数据库结构变更。
 *
 * 注意：短信验证码和登录尝试记录已改为 Redis 存储，不再需要对应的 MySQL 表。
 *
 * 迁移脚本的工作方式：
 * - up() 方法：执行迁移（创建表）
 * - down() 方法：回滚迁移（删除表），用于出错时恢复
 *
 * 运行方式：
 * - 执行迁移：npx typeorm migration:run -d src/config/typeorm.config.ts
 * - 回滚迁移：npx typeorm migration:revert -d src/config/typeorm.config.ts
 */
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * 创建初始数据库表的迁移类
 * @description 包含 users、documents、user_settings 三张表
 */
export class CreateInitialTables1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== 1. 创建 users 表（用户表） ==========
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            // MySQL 中 UUID 需要手动生成，TypeORM 会在应用层处理
          },
          {
            name: 'phone_encrypted',
            type: 'varchar',
            length: '255',
            comment: 'AES 加密后的手机号',
          },
          {
            name: 'phone_hash',
            type: 'varchar',
            length: '64',
            isUnique: true,
            comment: 'SHA-256 哈希后的手机号，用于查询',
          },
          {
            name: 'created_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true, // ifNotExists: 如果表已存在则跳过
    );

    // ========== 2. 创建 documents 表（文档表） ==========
    await queryRunner.createTable(
      new Table({
        name: 'documents',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
            comment: '关联用户 ID',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '50',
            comment: '文档标题，1-50 字符',
          },
          {
            name: 'content',
            type: 'longtext',
            comment: '富文本内容（JSON 格式）',
          },
          {
            name: 'created_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );

    // 为 documents 表的 user_id 列创建索引，加速按用户查询文档
    await queryRunner.createIndex(
      'documents',
      new TableIndex({
        name: 'IDX_documents_user_id',
        columnNames: ['user_id'],
      }),
    );

    // ========== 3. 创建 user_settings 表（用户设置表） ==========
    await queryRunner.createTable(
      new Table({
        name: 'user_settings',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
          },
          {
            name: 'user_id',
            type: 'varchar',
            length: '36',
            isUnique: true,
            comment: '关联用户 ID，每个用户只有一条设置记录',
          },
          {
            name: 'theme_mode',
            type: 'varchar',
            length: '10',
            default: "'light'",
            comment: '主题模式：light 或 dark',
          },
          {
            name: 'font_size',
            type: 'int',
            default: 16,
            comment: '字号大小，范围 12-24',
          },
          {
            name: 'hint_duration',
            type: 'int',
            default: 5,
            comment: '提示显示时长（秒），范围 3-30',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            length: '6',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 回滚时按照创建的逆序删除表
    await queryRunner.dropTable('user_settings', true);
    await queryRunner.dropTable('documents', true);
    await queryRunner.dropTable('users', true);
  }
}
