/**
 * 数据库配置文件
 *
 * 用途：从环境变量中读取 MySQL 数据库连接参数，供 TypeORM 使用。
 * registerAs('database') 表示在 ConfigService 中通过 'database' 命名空间访问这些配置。
 */
import { registerAs } from '@nestjs/config';

/**
 * 数据库配置工厂函数
 * @description 使用 @nestjs/config 的 registerAs 注册为命名空间配置
 * 这样可以通过 configService.get('database.host') 来获取配置值
 */
export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'english_association',
}));
