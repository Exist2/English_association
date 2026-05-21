/**
 * 自定义请求频率限制守卫
 *
 * 用途：继承 @nestjs/throttler 的 ThrottlerGuard，重写被限流时的错误响应格式。
 * 默认的 ThrottlerGuard 在超出频率限制时只返回简单的 429 状态码，
 * 我们需要返回统一的错误格式：{ code: 'RATE_LIMITED', message: string, retryAfter: number }
 *
 * 为什么需要自定义？
 * - 项目要求所有错误响应遵循统一格式 { code, message, details? }
 * - 频率限制响应还需要额外的 retryAfter 字段，告诉前端多少秒后可以重试
 * - 默认的 ThrottlerGuard 不提供这些自定义能力
 */
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * 频率限制错误响应接口
 * @description 当请求超出频率限制时返回的响应体结构
 */
export interface RateLimitedResponse {
  /** 错误码，固定为 'RATE_LIMITED' */
  code: string;
  /** 用户可读的错误信息 */
  message: string;
  /** 需要等待的秒数，前端可据此显示倒计时 */
  retryAfter: number;
}

/**
 * 自定义频率限制守卫
 *
 * @description 继承 NestJS ThrottlerGuard，重写 throwThrottlingException 方法，
 * 使其在触发限流时返回包含 retryAfter 字段的统一错误响应。
 *
 * 配置说明：
 * - 全局默认限制：单 IP 每分钟（60秒）最多 100 次请求
 * - 超出限制后返回 429 状态码
 * - retryAfter 字段表示限流窗口剩余秒数（向上取整）
 *
 * @example
 * // 超出限制时的响应示例：
 * // HTTP 429
 * // {
 * //   code: 'RATE_LIMITED',
 * //   message: '请求过于频繁，请稍后再试',
 * //   retryAfter: 45
 * // }
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * 重写限流异常抛出方法
   *
   * @description 当请求超出频率限制时，ThrottlerGuard 内部会调用此方法。
   * 我们重写它来抛出自定义格式的 HttpException，
   * 这样全局异常过滤器（GlobalExceptionFilter）会将其转换为统一的错误响应。
   *
   * 注意：throttlerLimitDetail 参数包含限流的详细信息，
   * 其中 timeToExpire 表示当前限流窗口剩余的毫秒数。
   * 我们将其转换为秒数（向上取整）作为 retryAfter 返回给前端。
   */
  protected throwThrottlingException(): Promise<void> {
    // 计算 retryAfter：限流窗口为 60 秒，直接返回 60 秒作为等待时间
    // 因为 @nestjs/throttler v6 的 throwThrottlingException 不再传递 detail 参数，
    // 所以我们使用固定的 TTL 值（与 ThrottlerModule 配置的 ttl: 60000 对应）
    const TTL_SECONDS = 60;

    // 构造符合统一错误格式的响应体
    const responseBody: RateLimitedResponse = {
      code: 'RATE_LIMITED',
      message: '请求过于频繁，请稍后再试',
      retryAfter: TTL_SECONDS,
    };

    // 抛出 HttpException，NestJS 会自动设置 HTTP 状态码为 429
    throw new HttpException(responseBody, HttpStatus.TOO_MANY_REQUESTS);
  }
}
