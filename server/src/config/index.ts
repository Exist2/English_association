/**
 * 配置模块统一导出入口
 *
 * 用途：将所有配置文件集中导出，方便在 AppModule 中一次性导入。
 */
export { default as appConfig } from './app.config';
export { default as databaseConfig } from './database.config';
