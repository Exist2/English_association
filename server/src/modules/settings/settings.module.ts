/**
 * 设置模块
 *
 * 用途：管理用户的个性化设置，包括主题模式（明亮/暗黑）、字号大小、提示显示时长等。
 * 设置会持久化存储，用户登录后自动恢复。
 *
 * 注册的实体：
 * - UserSettings：用户个性化配置（主题、字号、提示时长）
 *
 * 注册的控制器：
 * - SettingsController：提供主题配置的 GET 和 POST 端点
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSettings } from './entities';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [
    /**
     * 注册 UserSettings 实体，使其可以在本模块中通过 Repository 进行数据库操作
     */
    TypeOrmModule.forFeature([UserSettings]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
