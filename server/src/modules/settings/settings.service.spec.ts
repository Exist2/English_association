/**
 * SettingsService 单元测试
 *
 * 测试策略：
 * - Mock TypeORM Repository（模拟数据库操作）
 * - 测试 getTheme 方法的正常流程和无记录时的默认值返回
 * - 测试 updateTheme 方法的验证逻辑和更新流程
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UserSettings } from './entities';

describe('SettingsService', () => {
  let service: SettingsService;

  /** Mock Repository 对象，模拟数据库操作 */
  const mockSettingsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: getRepositoryToken(UserSettings),
          useValue: mockSettingsRepository,
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);

    // 每个测试前重置所有 Mock
    jest.clearAllMocks();
  });

  describe('getTheme（获取主题配置）', () => {
    const userId = 'user-123';

    it('用户有设置记录时应返回对应配置', async () => {
      const mockSettings = {
        id: 'settings-1',
        userId,
        themeMode: 'dark',
        fontSize: 18,
        hintDuration: 10,
        updatedAt: new Date(),
      };
      mockSettingsRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.getTheme(userId);

      expect(result).toEqual({
        mode: 'dark',
        fontSize: 18,
        hintDuration: 10,
      });
      expect(mockSettingsRepository.findOne).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('用户无设置记录时应返回默认配置', async () => {
      mockSettingsRepository.findOne.mockResolvedValue(null);

      const result = await service.getTheme(userId);

      expect(result).toEqual({
        mode: 'light',
        fontSize: 16,
        hintDuration: 5,
      });
    });

    it('返回的默认配置应为独立副本（修改不影响后续调用）', async () => {
      mockSettingsRepository.findOne.mockResolvedValue(null);

      const result1 = await service.getTheme(userId);
      result1.fontSize = 99;

      const result2 = await service.getTheme(userId);
      expect(result2.fontSize).toBe(16);
    });
  });

  describe('updateTheme（更新主题配置）', () => {
    const userId = 'user-123';

    describe('验证逻辑', () => {
      it('fontSize 小于 12 时应抛出 BadRequestException', async () => {
        await expect(
          service.updateTheme(userId, { fontSize: 11 }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.updateTheme(userId, { fontSize: 11 }),
        ).rejects.toThrow('字号大小必须是 12 到 24 之间的整数');
      });

      it('fontSize 大于 24 时应抛出 BadRequestException', async () => {
        await expect(
          service.updateTheme(userId, { fontSize: 25 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('fontSize 为浮点数时应抛出 BadRequestException', async () => {
        await expect(
          service.updateTheme(userId, { fontSize: 14.5 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('hintDuration 小于 3 时应抛出 BadRequestException', async () => {
        await expect(
          service.updateTheme(userId, { hintDuration: 2 }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.updateTheme(userId, { hintDuration: 2 }),
        ).rejects.toThrow('提示显示时长必须是 3 到 30 之间的整数');
      });

      it('hintDuration 大于 30 时应抛出 BadRequestException', async () => {
        await expect(
          service.updateTheme(userId, { hintDuration: 31 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('hintDuration 为浮点数时应抛出 BadRequestException', async () => {
        await expect(
          service.updateTheme(userId, { hintDuration: 5.5 }),
        ).rejects.toThrow(BadRequestException);
      });

      it('mode 为无效值时应抛出 BadRequestException', async () => {
        await expect(
          service.updateTheme(userId, { mode: 'blue' as 'light' | 'dark' }),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service.updateTheme(userId, { mode: 'blue' as 'light' | 'dark' }),
        ).rejects.toThrow('主题模式必须是 light 或 dark');
      });
    });

    describe('更新已有记录', () => {
      const existingSettings = {
        id: 'settings-1',
        userId,
        themeMode: 'light',
        fontSize: 16,
        hintDuration: 5,
        updatedAt: new Date(),
      };

      it('应该成功更新 mode', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, { mode: 'dark' });

        expect(result.mode).toBe('dark');
        expect(result.fontSize).toBe(16);
        expect(result.hintDuration).toBe(5);
      });

      it('应该成功更新 fontSize', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, { fontSize: 20 });

        expect(result.fontSize).toBe(20);
        expect(result.mode).toBe('light');
      });

      it('应该成功更新 hintDuration', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, { hintDuration: 15 });

        expect(result.hintDuration).toBe(15);
      });

      it('应该同时更新多个字段', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, {
          mode: 'dark',
          fontSize: 20,
          hintDuration: 10,
        });

        expect(result).toEqual({
          mode: 'dark',
          fontSize: 20,
          hintDuration: 10,
        });
      });

      it('不传任何字段时应保持原配置不变', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, {});

        expect(result).toEqual({
          mode: 'light',
          fontSize: 16,
          hintDuration: 5,
        });
      });

      it('fontSize 边界值 12 应通过验证', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, { fontSize: 12 });
        expect(result.fontSize).toBe(12);
      });

      it('fontSize 边界值 24 应通过验证', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, { fontSize: 24 });
        expect(result.fontSize).toBe(24);
      });

      it('hintDuration 边界值 3 应通过验证', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, { hintDuration: 3 });
        expect(result.hintDuration).toBe(3);
      });

      it('hintDuration 边界值 30 应通过验证', async () => {
        mockSettingsRepository.findOne.mockResolvedValue({ ...existingSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, { hintDuration: 30 });
        expect(result.hintDuration).toBe(30);
      });
    });

    describe('创建新记录', () => {
      it('用户无设置记录时应创建新记录并更新', async () => {
        mockSettingsRepository.findOne.mockResolvedValue(null);
        // create 返回一个新的实体对象
        const newSettings = {
          userId,
          themeMode: 'light',
          fontSize: 16,
          hintDuration: 5,
        };
        mockSettingsRepository.create.mockReturnValue({ ...newSettings });
        mockSettingsRepository.save.mockImplementation((s) => Promise.resolve(s));

        const result = await service.updateTheme(userId, { mode: 'dark' });

        expect(mockSettingsRepository.create).toHaveBeenCalledWith({
          userId,
          themeMode: 'light',
          fontSize: 16,
          hintDuration: 5,
        });
        expect(result.mode).toBe('dark');
      });
    });
  });
});
