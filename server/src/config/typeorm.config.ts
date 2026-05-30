/**
 * TypeORM CLI 配置文件
 *
 * 用途：供 TypeORM CLI 工具使用的数据源配置。
 * 当你需要在命令行中运行迁移脚本时，TypeORM CLI 会读取这个文件来连接数据库。
 *
 * 使用方式：
 * - 运行迁移：npx typeorm migration:run -d src/config/typeorm.config.ts
 * - 回滚迁移：npx typeorm migration:revert -d src/config/typeorm.config.ts
 * - 生成迁移：npx typeorm migration:generate -d src/config/typeorm.config.ts src/migrations/XxxMigration
 *
 * 注意：这个文件与 app.module.ts 中的 TypeOrmModule 配置是独立的。
 * app.module.ts 中的配置用于应用运行时，这个文件用于 CLI 工具。
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// 判断当前是否是编译后的环境（如果当前文件是 .js 结尾，说明在 dist 目录下）
const isCompiled = __filename.endsWith('.js');
const rootDir = isCompiled ? 'dist' : 'src';
const ext = isCompiled ? 'js' : 'ts';

// 手动加载 .env 文件（CLI 工具不会自动加载 NestJS 的 ConfigModule）
dotenv.config();

/**
 * TypeORM 数据源配置
 * @description 导出一个 DataSource 实例供 CLI 使用
 */
export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'english_association',
  // 实体文件路径（CLI 需要知道实体在哪里）
  // 动态设置实体和迁移文件的路径
  entities: [`${rootDir}/modules/**/entities/*.entity.${ext}`],
  migrations: [`${rootDir}/migrations/[0-9]*-*.${ext}`],
  // CLI 工具中不使用 synchronize
  synchronize: false,
});
