/**
 * JwtAuthGuard 单元测试
 *
 * 测试策略：
 * - Mock AuthService.validateToken 方法
 * - Mock Reflector 来模拟 @Public() 装饰器的行为
 * - 验证守卫在各种场景下的行为（公开路由、有效令牌、无效令牌、缺少令牌）
 */
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from '../../modules/auth/auth.service';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let authService: jest.Mocked<AuthService>;

  /**
   * 创建模拟的 ExecutionContext
   * ExecutionContext 是 NestJS 在每个请求中传递给守卫的上下文对象
   */
  function createMockContext(authHeader?: string): ExecutionContext {
    const request = {
      headers: {
        authorization: authHeader,
      },
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    authService = {
      validateToken: jest.fn(),
    } as unknown as jest.Mocked<AuthService>;

    guard = new JwtAuthGuard(reflector, authService);
  });

  it('应该对标记 @Public() 的路由直接放行', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authService.validateToken).not.toHaveBeenCalled();
  });

  it('应该在缺少 Authorization 头时抛出 UnauthorizedException', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext(undefined);

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('应该在 Authorization 头格式错误时抛出 UnauthorizedException', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext('Basic abc123');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('应该在令牌有效时放行并附加用户信息', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const mockPayload = { sub: 'user-uuid', phoneHash: 'hash123' };
    authService.validateToken.mockResolvedValue(mockPayload);

    const context = createMockContext('Bearer valid_token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authService.validateToken).toHaveBeenCalledWith('valid_token');

    // 验证用户信息已附加到 request 对象
    const request = context.switchToHttp().getRequest();
    expect((request as { user: unknown }).user).toEqual(mockPayload);
  });

  it('应该在令牌无效时抛出 UnauthorizedException', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    authService.validateToken.mockRejectedValue(
      new UnauthorizedException('令牌无效或已过期'),
    );

    const context = createMockContext('Bearer invalid_token');

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
