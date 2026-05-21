/**
 * @Public() 装饰器
 *
 * 用途：标记不需要 JWT 认证的公开路由。
 *
 * 原理：
 * - NestJS 的 SetMetadata() 会在路由处理器上附加自定义元数据
 * - JwtAuthGuard 在执行时会检查路由是否带有 IS_PUBLIC_KEY 元数据
 * - 如果有该元数据，Guard 会跳过 JWT 校验，允许未认证用户访问
 *
 * 使用示例：
 * ```typescript
 * @Public()
 * @Post('login')
 * async login(@Body() dto: LoginDto) { ... }
 * ```
 */
import { SetMetadata } from '@nestjs/common';

/**
 * 元数据 Key 常量
 * JwtAuthGuard 通过此 Key 判断路由是否为公开路由
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 公开路由装饰器
 * @description 标记路由为公开访问，无需 JWT 认证
 * @returns MethodDecorator
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
