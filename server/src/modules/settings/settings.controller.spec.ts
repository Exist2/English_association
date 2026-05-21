/**
 * SettingsController 单元测试
 *
 * 测试策略：
 * - Mock SettingsService 的 getTheme 和 updateTheme 方法，隔离测试控制器逻辑
 * - 验证控制器正确调用 Service 方法并返回预期格式的响应
 * - 验证 getTheme 端点返回主题配置
 * - 验证 updateTheme 端点返回 { success: true, config: ... } 格式
 * - 验证异常情况下控制器正确传播 Service 抛出的异常
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { UserPayload } from '../../common/decorators/current-user.decorator';

describe('SettingsController', () => {
  let controller: SettingsController;
  let settingsService: jest.Mocked<SettingsService>;

  /** 模拟的当前登录用户信息 */
  const mockUser: UserPayload = {
    sub: 'user-uuid-123',
    phoneHash: 'hashed-phone-123',
  };

  beforeEach(async () => {
    // 创建 Mock SettingsService
    const mockSettingsService = {
      getTheme: jest.fn(),
      updateTheme: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SettingsController],
      providers: [
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    controller = module.get<SettingsController>(SettingsController);
    settingsService = module.get(
      SettingsService,
    ) as jest.Mocked<SettingsService>;
  });

  describe('getTheme', () => {
    it('应该返回用户的主题配置', async () => {
      // 模拟 Service 返回用户的主题配置
      const mockConfig = {
        mode: 'dark' as const,
        fontSize: 18,
        hintDuration: 10,
      };
      settingsService.getTheme.mockResolvedValue(mockConfig);

      const result = await controller.getTheme(mockUser);

      // 验证 Service 被正确调用，参数为 user.sub
      expect(settingsService.getTheme).toHaveBeenCalledWith('user-uuid-123');
      // 验证返回值与 Service 返回一致
      expect(result).toEqual(mockConfig);
    });

    it('应该在用户没有配置记录时返回默认配置', async () => {
      // 模拟 Service 返回默认配置（新用户场景）
      const defaultConfig = {
        mode: 'light' as const,
        fontSize: 16,
        hintDuration: 5,
      };
      settingsService.getTheme.mockResolvedValue(defaultConfig);

      const result = await controller.getTheme(mockUser);

      expect(settingsService.getTheme).toHaveBeenCalledWith('user-uuid-123');
      expect(result).toEqual(defaultConfig);
      expect(result.mode).toBe('light');
      expect(result.fontSize).toBe(16);
      expect(result.hintDuration).toBe(5);
    });

    it('应该在 Service 抛出异常时正确传播错误', async () => {
      settingsService.getTheme.mockRejectedValue(
        new Error('数据库连接失败'),
      );

      await expect(controller.getTheme(mockUser)).rejects.toThrow(
        '数据库连接失败',
      );
    });
  });

  describe('updateTheme', () => {
    it('应该成功更新主题模式并返回正确格式', async () => {
      const updatedConfig = {
        mode: 'dark' as const,
        fontSize: 16,
        hintDuration: 5,
      };
      settingsService.updateTheme.mockResolvedValue(updatedConfig);

      const result = await controller.updateTheme(mockUser, { mode: 'dark' });

      // 验证 Service 被正确调用
      expect(settingsService.updateTheme).toHaveBeenCalledWith(
        'user-uuid-123',
        { mode: 'dark' },
      );
      // 验证返回格式为 { success: true, config: ... }
      expect(result).toEqual({
        success: true,
        config: updatedConfig,
      });
    });

    it('应该成功更新字号大小', async () => {
      const updatedConfig = {
        mode: 'light' as const,
        fontSize: 20,
        hintDuration: 5,
      };
      settingsService.updateTheme.mockResolvedValue(updatedConfig);

      const result = await controller.updateTheme(mockUser, { fontSize: 20 });

      expect(settingsService.updateTheme).toHaveBeenCalledWith(
        'user-uuid-123',
        { fontSize: 20 },
      );
      expect(result.success).toBe(true);
      expect(result.config.fontSize).toBe(20);
    });

    it('应该成功更新提示时长', async () => {
      const updatedConfig = {
        mode: 'light' as const,
        fontSize: 16,
        hintDuration: 15,
      };
      settingsService.updateTheme.mockResolvedValue(updatedConfig);

      const result = await controller.updateTheme(mockUser, {
        hintDuration: 15,
      });

      expect(settingsService.updateTheme).toHaveBeenCalledWith(
        'user-uuid-123',
        { hintDuration: 15 },
      );
      expect(result.success).toBe(true);
      expect(result.config.hintDuration).toBe(15);
    });

    it('应该支持同时更新多个字段', async () => {
      const updatedConfig = {
        mode: 'dark' as const,
        fontSize: 20,
        hintDuration: 10,
      };
      settingsService.updateTheme.mockResolvedValue(updatedConfig);

      const dto: { mode: 'dark'; fontSize: number; hintDuration: number } = {
        mode: 'dark',
        fontSize: 20,
        hintDuration: 10,
      };
      const result = await controller.updateTheme(mockUser, dto);

      expect(settingsService.updateTheme).toHaveBeenCalledWith(
        'user-uuid-123',
        dto,
      );
      expect(result).toEqual({
        success: true,
        config: updatedConfig,
      });
    });

    it('应该在 Service 抛出 BadRequestException 时正确传播', async () => {
      // 模拟 Service 因参数不合法抛出异常
      settingsService.updateTheme.mockRejectedValue(
        new BadRequestException('字号大小必须是 12 到 24 之间的整数'),
      );

      await expect(
        controller.updateTheme(mockUser, { fontSize: 100 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('应该在传入空对象时正常调用 Service', async () => {
      const currentConfig = {
        mode: 'light' as const,
        fontSize: 16,
        hintDuration: 5,
      };
      settingsService.updateTheme.mockResolvedValue(currentConfig);

      const result = await controller.updateTheme(mockUser, {});

      expect(settingsService.updateTheme).toHaveBeenCalledWith(
        'user-uuid-123',
        {},
      );
      expect(result.success).toBe(true);
      expect(result.config).toEqual(currentConfig);
    });
  });
});
