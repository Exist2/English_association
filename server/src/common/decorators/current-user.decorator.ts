/**
 * CurrentUser 自定义装饰器
 *
 * 用途：从请求对象中提取当前登录用户的信息（UserPayload）。
 *
 * 工作原理：
 * - JwtAuthGuard 在验证 JWT 令牌后，会将解析出的用户信息附加到 request.user 上
 * - 本装饰器封装了从 request 中取 user 的逻辑，让控制器代码更简洁
 *
 * 使用方式：
 * ```typescript
 * @Post()
 * async create(@CurrentUser() user: UserPayload) {
 *   // user.sub 是用户 ID
 *   // user.phoneHash 是手机号哈希
 * }
 * ```
 *
 * 为什么需要自定义装饰器？
 * - 避免在每个控制器方法中重复写 @Req() req 然后 req.user
 * - 提供类型安全（返回 UserPayload 类型而非 any）
 * - 代码更清晰，一眼就能看出"这里需要当前用户信息"
 */
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * UserPayload 接口
 * @description JWT 令牌中存储的用户信息，与 AuthService 中定义的一致
 */
export interface UserPayload {
  /** 用户 UUID */
  sub: string;
  /** 手机号哈希（用于标识用户，不暴露真实手机号） */
  phoneHash: string;
}

/**
 * @CurrentUser() 参数装饰器
 *
 * @description 从 HTTP 请求中提取当前登录用户的信息
 * createParamDecorator 是 NestJS 提供的工厂函数，用于创建自定义参数装饰器
 *
 * @param _data - 装饰器参数（当前未使用，预留扩展）
 * @param ctx - 执行上下文，包含当前请求信息
 * @returns 当前登录用户的 UserPayload 对象
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserPayload => {
    // 从执行上下文中获取 HTTP 请求对象
    const request = ctx.switchToHttp().getRequest<Request & { user: UserPayload }>();

    // 返回 JwtAuthGuard 附加到 request 上的用户信息
    return request.user;
  },
);
