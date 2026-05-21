/**
 * AuthService 单元测试
 *
 * 测试策略：
 * - Mock TypeORM Repository（模拟数据库操作）
 * - Mock Redis 客户端（模拟缓存操作）
 * - Mock JwtService（模拟 JWT 签发/验证）
 * - 测试每个方法的正常流程和异常情况
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from './entities';
import { REDIS_CLIENT } from '../../common/redis';

describe('AuthService', () => {
  let service: AuthService;

  // Mock 对象
  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    // 设置测试所需的环境变量
    process.env.ENCRYPTION_KEY = 'test_encryption_key_32chars_long!';

    // 创建测试模块，注入所有 Mock 依赖
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: REDIS_CLIENT,
          useValue: mockRedis,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // 每个测试前重置所有 Mock
    jest.clearAllMocks();
  });

  describe('register（用户注册）', () => {
    it('应该成功注册新用户', async () => {
      const phone = '13812345678';
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({ phoneEncrypted: 'enc', phoneHash: 'hash' });
      mockUserRepository.save.mockResolvedValue({ id: 'uuid-1' });

      await expect(service.register(phone)).resolves.toBeUndefined();
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('手机号格式无效时应抛出 BadRequestException', async () => {
      await expect(service.register('123')).rejects.toThrow(BadRequestException);
      await expect(service.register('12345678901')).rejects.toThrow(BadRequestException);
    });

    it('手机号已注册时应抛出 ConflictException', async () => {
      const phone = '13812345678';
      mockUserRepository.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(phone)).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyCaptcha（滑块验证码校验）', () => {
    it('Mock 实现应始终返回 true', async () => {
      const result = await service.verifyCaptcha('13812345678', 'any-token');
      expect(result).toBe(true);
    });
  });

  describe('sendSmsCode（发送短信验证码）', () => {
    it('应该成功发送验证码', async () => {
      const phone = '13812345678';
      mockRedis.get.mockResolvedValue(null); // 无频率限制

      await expect(service.sendSmsCode(phone)).resolves.toBeUndefined();

      // 验证 Redis 存储了验证码和频率限制
      expect(mockRedis.set).toHaveBeenCalledTimes(2);
      // 第一次调用：存储验证码
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('sms:code:'),
        expect.stringMatching(/^\d{6}$/), // 6位数字
        'EX',
        60,
      );
      // 第二次调用：设置频率限制
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('sms:limit:'),
        '1',
        'EX',
        60,
      );
    });

    it('手机号格式无效时应抛出 BadRequestException', async () => {
      await expect(service.sendSmsCode('invalid')).rejects.toThrow(BadRequestException);
    });

    it('60秒内重复发送应抛出 BadRequestException', async () => {
      const phone = '13812345678';
      mockRedis.get.mockResolvedValue('1'); // 频率限制存在

      await expect(service.sendSmsCode(phone)).rejects.toThrow(BadRequestException);
      await expect(service.sendSmsCode(phone)).rejects.toThrow('验证码发送过于频繁');
    });
  });

  describe('login（用户登录）', () => {
    const phone = '13812345678';
    const code = '123456';

    it('验证码正确时应返回 JWT 令牌', async () => {
      // 无锁定记录
      mockRedis.get
        .mockResolvedValueOnce(null) // isAccountLocked: 无尝试记录
        .mockResolvedValueOnce(code); // 存储的验证码
      mockRedis.del.mockResolvedValue(1);
      mockUserRepository.findOne.mockResolvedValue({ id: 'user-1', phoneHash: 'hash' });
      mockJwtService.sign.mockReturnValue('jwt-token-here');

      const result = await service.login(phone, code);

      expect(result.accessToken).toBe('jwt-token-here');
      expect(result.expiresIn).toBe(604800); // 7天的秒数
      expect(mockRedis.del).toHaveBeenCalledTimes(2); // 删除验证码 + 删除失败记录
    });

    it('用户不存在时应自动注册并返回令牌', async () => {
      mockRedis.get
        .mockResolvedValueOnce(null) // 无锁定
        .mockResolvedValueOnce(code); // 验证码正确
      mockRedis.del.mockResolvedValue(1);
      mockUserRepository.findOne.mockResolvedValue(null); // 用户不存在
      mockUserRepository.create.mockReturnValue({ phoneEncrypted: 'enc', phoneHash: 'hash' });
      mockUserRepository.save.mockResolvedValue({ id: 'new-user', phoneHash: 'hash' });
      mockJwtService.sign.mockReturnValue('new-jwt-token');

      const result = await service.login(phone, code);

      expect(result.accessToken).toBe('new-jwt-token');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('验证码过期（不存在）时应抛出 UnauthorizedException', async () => {
      mockRedis.get
        .mockResolvedValueOnce(null) // 无锁定
        .mockResolvedValueOnce(null); // 验证码不存在（已过期）
      mockRedis.ttl.mockResolvedValue(-2); // key 不存在

      await expect(service.login(phone, code)).rejects.toThrow('验证码已过期');
    });

    it('验证码错误时应抛出 UnauthorizedException', async () => {
      mockRedis.get
        .mockResolvedValueOnce(null) // 无锁定
        .mockResolvedValueOnce('654321'); // 存储的验证码与输入不匹配
      mockRedis.ttl.mockResolvedValue(-2);

      await expect(service.login(phone, code)).rejects.toThrow('验证码错误');
    });

    it('账户锁定时应抛出 UnauthorizedException', async () => {
      // 模拟已锁定状态：failedCount >= 5
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ failedCount: 5 }));
      mockRedis.ttl.mockResolvedValue(600); // 剩余 10 分钟

      await expect(service.login(phone, code)).rejects.toThrow('账户已锁定');
    });

    it('手机号格式无效时应抛出 BadRequestException', async () => {
      await expect(service.login('invalid', code)).rejects.toThrow(BadRequestException);
    });
  });

  describe('isAccountLocked（账户锁定检查）', () => {
    const phone = '13812345678';

    it('无失败记录时应返回未锁定', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await service.isAccountLocked(phone);
      expect(result.locked).toBe(false);
    });

    it('失败次数少于5次时应返回未锁定', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ failedCount: 3 }));

      const result = await service.isAccountLocked(phone);
      expect(result.locked).toBe(false);
    });

    it('失败次数达到5次时应返回锁定状态', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ failedCount: 5 }));
      mockRedis.ttl.mockResolvedValue(600); // 剩余 600 秒 = 10 分钟

      const result = await service.isAccountLocked(phone);
      expect(result.locked).toBe(true);
      expect(result.remainingMinutes).toBe(10);
    });

    it('失败次数超过5次时也应返回锁定状态', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ failedCount: 7 }));
      mockRedis.ttl.mockResolvedValue(300); // 剩余 5 分钟

      const result = await service.isAccountLocked(phone);
      expect(result.locked).toBe(true);
      expect(result.remainingMinutes).toBe(5);
    });
  });

  describe('validateToken（JWT 校验）', () => {
    it('有效令牌应返回用户载荷', async () => {
      const payload = { sub: 'user-1', phoneHash: 'hash-value' };
      mockJwtService.verify.mockReturnValue(payload);

      const result = await service.validateToken('valid-token');
      expect(result).toEqual(payload);
    });

    it('无效令牌应抛出 UnauthorizedException', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.validateToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('过期令牌应抛出 UnauthorizedException', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.validateToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
