/**
 * AuthController 单元测试
 *
 * 测试策略：
 * - Mock AuthService 的所有方法，隔离测试控制器逻辑
 * - 验证控制器正确调用 Service 方法并返回预期格式的响应
 * - 验证异常情况下控制器正确传播 Service 抛出的异常
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    // 创建 Mock AuthService
    const mockAuthService = {
      register: jest.fn(),
      verifyCaptcha: jest.fn(),
      sendSmsCode: jest.fn(),
      login: jest.fn(),
      validateToken: jest.fn(),
      isAccountLocked: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService) as jest.Mocked<AuthService>;
  });

  describe('register', () => {
    it('应该成功注册并返回 success 响应', async () => {
      authService.register.mockResolvedValue(undefined);

      const result = await controller.register({ phone: '13800138000' });

      expect(authService.register).toHaveBeenCalledWith('13800138000');
      expect(result).toEqual({ success: true, message: '注册成功' });
    });

    it('应该在手机号已注册时传播 ConflictException', async () => {
      authService.register.mockRejectedValue(
        new ConflictException('该手机号已注册'),
      );

      await expect(
        controller.register({ phone: '13800138000' }),
      ).rejects.toThrow(ConflictException);
    });

    it('应该在手机号格式无效时传播 BadRequestException', async () => {
      authService.register.mockRejectedValue(
        new BadRequestException('手机号格式无效'),
      );

      await expect(
        controller.register({ phone: '1380013800' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('captchaVerify', () => {
    it('应该在验证通过时返回 canSendSms: true', async () => {
      authService.verifyCaptcha.mockResolvedValue(true);

      const result = await controller.captchaVerify({
        phone: '13800138000',
        captchaToken: 'valid_token',
      });

      expect(authService.verifyCaptcha).toHaveBeenCalledWith(
        '13800138000',
        'valid_token',
      );
      expect(result).toEqual({ success: true, canSendSms: true });
    });

    it('应该在验证失败时返回 canSendSms: false', async () => {
      authService.verifyCaptcha.mockResolvedValue(false);

      const result = await controller.captchaVerify({
        phone: '13800138000',
        captchaToken: 'invalid_token',
      });

      expect(result).toEqual({ success: false, canSendSms: false });
    });
  });

  describe('sendSms', () => {
    it('应该成功发送验证码并返回 success 响应', async () => {
      authService.sendSmsCode.mockResolvedValue(undefined);

      const result = await controller.sendSms({ phone: '13800138000' });

      expect(authService.sendSmsCode).toHaveBeenCalledWith('13800138000');
      expect(result).toEqual({ success: true, message: '验证码已发送' });
    });

    it('应该在发送过于频繁时传播 BadRequestException', async () => {
      authService.sendSmsCode.mockRejectedValue(
        new BadRequestException('验证码发送过于频繁，请60秒后重试'),
      );

      await expect(
        controller.sendSms({ phone: '13800138000' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('应该成功登录并返回 JWT 令牌', async () => {
      const loginResult = {
        accessToken: 'jwt_token_here',
        expiresIn: 604800,
      };
      authService.login.mockResolvedValue(loginResult);

      const result = await controller.login({
        phone: '13800138000',
        code: '123456',
      });

      expect(authService.login).toHaveBeenCalledWith('13800138000', '123456');
      expect(result).toEqual(loginResult);
    });

    it('应该在验证码错误时传播 UnauthorizedException', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('验证码错误'),
      );

      await expect(
        controller.login({ phone: '13800138000', code: '000000' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('应该在账户锁定时传播 UnauthorizedException', async () => {
      authService.login.mockRejectedValue(
        new UnauthorizedException('账户已锁定，请15分钟后重试'),
      );

      await expect(
        controller.login({ phone: '13800138000', code: '123456' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
