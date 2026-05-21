/**
 * 主题设置服务（SettingsService）
 *
 * 用途：处理用户主题配置的读取和更新逻辑。
 * - getTheme：获取用户的主题配置，如果用户没有配置记录则返回默认值
 * - updateTheme：更新用户的主题配置，包含字段验证逻辑
 *
 * 验证规则：
 * - fontSize：必须是 12-24 之间的整数
 * - hintDuration：必须是 3-30 之间的整数
 * - mode：必须是 'light' 或 'dark'
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entities';
import { ThemeConfig } from './interfaces';

/** 默认主题配置（新用户或无配置记录时使用） */
const DEFAULT_THEME_CONFIG: ThemeConfig = {
  mode: 'light',
  fontSize: 16,
  hintDuration: 5,
};

/**
 * 主题设置服务
 * @description 负责用户主题配置的读取、验证和持久化
 */
@Injectable()
export class SettingsService {
  constructor(
    /**
     * 注入 UserSettings 的 TypeORM Repository
     * Repository 是 TypeORM 提供的数据访问对象，封装了常用的数据库操作（增删改查）
     */
    @InjectRepository(UserSettings)
    private readonly settingsRepository: Repository<UserSettings>,
  ) {}

  /**
   * 获取用户的主题配置
   * @param userId - 用户 ID
   * @returns 用户的主题配置对象；如果用户没有配置记录，返回默认配置
   *
   * 逻辑说明：
   * 1. 通过 userId 查询 user_settings 表
   * 2. 如果找到记录，将实体字段映射为 ThemeConfig 接口格式返回
   * 3. 如果没有记录（新用户），返回默认配置（light 主题、16px 字号、5秒提示时长）
   */
  async getTheme(userId: string): Promise<ThemeConfig> {
    // 根据 userId 查找用户的设置记录
    const settings = await this.settingsRepository.findOne({
      where: { userId },
    });

    // 如果没有找到记录，返回默认配置
    if (!settings) {
      return { ...DEFAULT_THEME_CONFIG };
    }

    // 将数据库实体映射为 ThemeConfig 接口格式
    return {
      mode: settings.themeMode as 'light' | 'dark',
      fontSize: settings.fontSize,
      hintDuration: settings.hintDuration,
    };
  }

  /**
   * 更新用户的主题配置
   * @param userId - 用户 ID
   * @param data - 要更新的配置字段（支持部分更新）
   * @returns 更新后的完整主题配置对象
   * @throws BadRequestException 当 fontSize、hintDuration 或 mode 不合法时
   *
   * 逻辑说明：
   * 1. 先验证传入的字段值是否合法
   * 2. 查找用户现有的设置记录，如果没有则创建新记录
   * 3. 将合法的字段值更新到记录中
   * 4. 保存到数据库并返回更新后的配置
   */
  async updateTheme(
    userId: string,
    data: Partial<ThemeConfig>,
  ): Promise<ThemeConfig> {
    // ===== 字段验证 =====

    // 验证 fontSize：必须是 12-24 之间的整数
    if (data.fontSize !== undefined) {
      if (
        !Number.isInteger(data.fontSize) ||
        data.fontSize < 12 ||
        data.fontSize > 24
      ) {
        throw new BadRequestException(
          '字号大小必须是 12 到 24 之间的整数',
        );
      }
    }

    // 验证 hintDuration：必须是 3-30 之间的整数
    if (data.hintDuration !== undefined) {
      if (
        !Number.isInteger(data.hintDuration) ||
        data.hintDuration < 3 ||
        data.hintDuration > 30
      ) {
        throw new BadRequestException(
          '提示显示时长必须是 3 到 30 之间的整数',
        );
      }
    }

    // 验证 mode：必须是 'light' 或 'dark'
    if (data.mode !== undefined) {
      if (data.mode !== 'light' && data.mode !== 'dark') {
        throw new BadRequestException(
          '主题模式必须是 light 或 dark',
        );
      }
    }

    // ===== 查找或创建设置记录 =====

    let settings = await this.settingsRepository.findOne({
      where: { userId },
    });

    if (!settings) {
      // 用户没有设置记录，创建一条新记录（使用默认值）
      settings = this.settingsRepository.create({
        userId,
        themeMode: DEFAULT_THEME_CONFIG.mode,
        fontSize: DEFAULT_THEME_CONFIG.fontSize,
        hintDuration: DEFAULT_THEME_CONFIG.hintDuration,
      });
    }

    // ===== 更新字段 =====

    if (data.mode !== undefined) {
      settings.themeMode = data.mode;
    }
    if (data.fontSize !== undefined) {
      settings.fontSize = data.fontSize;
    }
    if (data.hintDuration !== undefined) {
      settings.hintDuration = data.hintDuration;
    }

    // 保存到数据库
    const saved = await this.settingsRepository.save(settings);

    // 返回更新后的 ThemeConfig
    return {
      mode: saved.themeMode as 'light' | 'dark',
      fontSize: saved.fontSize,
      hintDuration: saved.hintDuration,
    };
  }
}
