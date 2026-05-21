/**
 * 自定义频率限制守卫单元测试
 *
 * 用途：验证 CustomThrottlerGuard 在触发限流时返回正确的错误响应格式。
 * 测试重点：
 * - throwThrottlingException 方法抛出的异常包含正确的状态码（429）
 * - 响应体包含 code: 'RATE_LIMITED'
 * - 响应体包含 retryAfter 字段（数值类型）
 * - 响应体包含用户可读的 message
 */
import { HttpException, HttpStatus } from '@nestjs/common';
import { CustomThrottlerGuard } from './custom-throttler.guard';

describe('CustomThrottlerGuard', () => {
  let guard: CustomThrottlerGuard;

  beforeEach(() => {
    // 创建守卫实例
    // 由于 ThrottlerGuard 需要依赖注入，我们直接通过 Object.create 创建实例
    // 只测试 throwThrottlingException 方法的行为
    guard = Object.create(CustomThrottlerGuard.prototype);
  });

  describe('throwThrottlingException', () => {
    it('应抛出 429 状态码的 HttpException', async () => {
      // 调用受保护的方法（通过类型断言访问）
      try {
        await (guard as unknown as { throwThrottlingException: () => Promise<void> }).throwThrottlingException();
        // 如果没有抛出异常，测试应失败
        fail('应该抛出异常');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      }
    });

    it('响应体应包含 code 为 RATE_LIMITED', async () => {
      try {
        await (guard as unknown as { throwThrottlingException: () => Promise<void> }).throwThrottlingException();
        fail('应该抛出异常');
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response['code']).toBe('RATE_LIMITED');
      }
    });

    it('响应体应包含 retryAfter 字段且为正整数', async () => {
      try {
        await (guard as unknown as { throwThrottlingException: () => Promise<void> }).throwThrottlingException();
        fail('应该抛出异常');
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response['retryAfter']).toBeDefined();
        expect(typeof response['retryAfter']).toBe('number');
        expect(response['retryAfter']).toBeGreaterThan(0);
      }
    });

    it('响应体应包含用户可读的 message', async () => {
      try {
        await (guard as unknown as { throwThrottlingException: () => Promise<void> }).throwThrottlingException();
        fail('应该抛出异常');
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response['message']).toBeDefined();
        expect(typeof response['message']).toBe('string');
        expect((response['message'] as string).length).toBeGreaterThan(0);
      }
    });

    it('retryAfter 应为 60 秒（与 ThrottlerModule 的 ttl 配置一致）', async () => {
      try {
        await (guard as unknown as { throwThrottlingException: () => Promise<void> }).throwThrottlingException();
        fail('应该抛出异常');
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response['retryAfter']).toBe(60);
      }
    });
  });
});
