/**
 * JWT 认证守卫
 *
 * 用途：保护需要登录才能访问的 API 路由。
 *
 * 工作流程：
 * 1. 检查路由是否标记了 @Public() 装饰器，如果是则跳过认证
 * 2. 从请求头 Authorization 中提取 Bearer Token
 * 3. 调用 AuthService.validateToken() 验证令牌有效性
 * 4. 验证通过后将用户信息（UserPayload）附加到 request.user 上
 * 5. 验证失败返回 401 Unauthorized 错误
 *
 * 为什么需要全局守卫？
 * - 大部分 API 都需要认证，全局注册后默认所有路由都受保护
 * - 少数公开路由（如登录、注册）通过 @Public() 装饰器豁免
 * - 这样比在每个控制器上单独添加 @UseGuards() 更安全，不会遗漏
 */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService, UserPayload } from '../../modules/auth/auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';

/**
 * JWT 认证守卫
 * @description 实现 CanActivate 接口，NestJS 在每个请求到达控制器之前调用 canActivate 方法
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    /**
     * Reflector 是 NestJS 提供的工具类，用于读取装饰器设置的元数据
     * 这里用它来检查路由是否标记了 @Public()
     */
    private readonly reflector: Reflector,

    /** 认证服务，提供 validateToken 方法验证 JWT 令牌 */
    private readonly authService: AuthService,
  ) {}

  /**
   * 守卫核心方法
   * @param context - 执行上下文，包含当前请求的处理器和类信息
   * @returns true 表示允许访问，抛出异常表示拒绝访问
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 步骤1：检查路由是否标记为公开
    // getAllAndOverride 会依次检查方法级和类级的元数据
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // 当前处理方法（如 login()）
      context.getClass(), // 当前控制器类（如 AuthController）
    ]);

    // 如果路由标记为公开，直接放行
    if (isPublic) {
      return true;
    }

    // 步骤2：从请求头中提取 Bearer Token
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      // 没有提供令牌，返回 401
      throw new UnauthorizedException('请先登录');
    }

    // 步骤3：验证令牌有效性
    try {
      const payload: UserPayload =
        await this.authService.validateToken(token);

      // 步骤4：将用户信息附加到 request 对象上
      // 后续的控制器方法可以通过 request.user 获取当前登录用户信息
      (request as Request & { user: UserPayload }).user = payload;
    } catch {
      // 令牌无效或已过期
      throw new UnauthorizedException('令牌无效或已过期');
    }

    return true;
  }

  /**
   * 从请求头中提取 Bearer Token
   *
   * Authorization 头格式：Bearer <token>
   * 例如：Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *
   * @param request - Express 请求对象
   * @returns JWT 令牌字符串，如果格式不正确则返回 undefined
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    // 从 Authorization 头中按空格分割，取出 type 和 token
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    // 只接受 Bearer 类型的令牌
    return type === 'Bearer' ? token : undefined;
  }
}
