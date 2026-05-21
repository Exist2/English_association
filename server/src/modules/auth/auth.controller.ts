/**
 * 认证控制器（AuthController）
 *
 * 用途：处理用户认证相关的 HTTP 请求，包括注册、滑块验证、短信发送和登录。
 *
 * 路由前缀：/api/auth（全局前缀 'api' + 控制器前缀 'auth'）
 *
 * 所有端点均为公开路由（使用 @Public() 装饰器），无需 JWT 认证。
 * 因为用户在登录之前还没有 JWT 令牌，所以认证相关接口必须公开。
 */
import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, CaptchaVerifyDto, SendSmsDto, LoginDto } from './dto';
import { Public } from '../../common/guards/public.decorator';

/**
 * 认证控制器
 * @description 提供注册、验证码校验、短信发送、登录四个公开端点
 */
@ApiTags('认证模块')
@Controller('auth')
@Public() // 整个控制器的所有路由都是公开的，无需 JWT 认证
export class AuthController {
  constructor(
    /** 注入认证服务，处理具体的业务逻辑 */
    private readonly authService: AuthService,
  ) {}

  /**
   * 用户注册
   *
   * 流程：验证手机号格式 → 检查是否已注册 → 创建用户记录
   *
   * @param dto - 注册请求体，包含手机号
   * @returns 注册结果
   */
  @Post('register')
  @ApiOperation({ summary: '用户注册', description: '使用手机号注册新账户' })
  @ApiBody({ type: RegisterDto, description: '注册请求体' })
  @ApiResponse({
    status: 201,
    description: '注册成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '注册成功' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '手机号格式无效' })
  @ApiResponse({ status: 409, description: '手机号已注册' })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.register(dto.phone);
    return { success: true, message: '注册成功' };
  }

  /**
   * 滑块验证码校验
   *
   * 流程：前端完成滑块验证 → 将 token 发送到后端 → 后端校验 token 有效性
   * 校验通过后前端才能调用发送短信接口
   *
   * @param dto - 验证码校验请求体，包含手机号和验证 token
   * @returns 校验结果，canSendSms 表示是否可以发送短信
   */
  @Post('captcha/verify')
  @ApiOperation({
    summary: '滑块验证码校验',
    description: '校验滑块验证码 token，通过后允许发送短信验证码',
  })
  @ApiBody({ type: CaptchaVerifyDto, description: '滑块验证码校验请求体' })
  @ApiResponse({
    status: 201,
    description: '验证结果',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        canSendSms: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  async captchaVerify(
    @Body() dto: CaptchaVerifyDto,
  ): Promise<{ success: boolean; canSendSms: boolean }> {
    const isValid = await this.authService.verifyCaptcha(
      dto.phone,
      dto.captchaToken,
    );
    return { success: isValid, canSendSms: isValid };
  }

  /**
   * 发送短信验证码
   *
   * 流程：验证手机号格式 → 检查频率限制 → 生成验证码 → 存入 Redis → 发送短信
   * 同一手机号 60 秒内只能发送 1 次
   *
   * @param dto - 发送短信请求体，包含手机号
   * @returns 发送结果
   */
  @Post('sms/send')
  @ApiOperation({
    summary: '发送短信验证码',
    description: '向指定手机号发送6位数字验证码，60秒内不可重复发送',
  })
  @ApiBody({ type: SendSmsDto, description: '发送短信请求体' })
  @ApiResponse({
    status: 201,
    description: '发送成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '验证码已发送' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '手机号格式无效或发送过于频繁' })
  async sendSms(
    @Body() dto: SendSmsDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.authService.sendSmsCode(dto.phone);
    return { success: true, message: '验证码已发送' };
  }

  /**
   * 用户登录
   *
   * 流程：验证手机号格式 → 检查账户锁定 → 校验验证码 → 签发 JWT 令牌
   * 连续 5 次验证码错误会锁定账户 15 分钟
   *
   * @param dto - 登录请求体，包含手机号和验证码
   * @returns JWT 令牌和过期时间
   */
  @Post('login')
  @ApiOperation({
    summary: '用户登录',
    description: '使用手机号和短信验证码登录，返回 JWT 令牌',
  })
  @ApiBody({ type: LoginDto, description: '登录请求体' })
  @ApiResponse({
    status: 201,
    description: '登录成功',
    schema: {
      type: 'object',
      properties: {
        accessToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        expiresIn: { type: 'number', example: 604800 },
      },
    },
  })
  @ApiResponse({ status: 400, description: '手机号格式无效' })
  @ApiResponse({ status: 401, description: '验证码错误或账户已锁定' })
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    return this.authService.login(dto.phone, dto.code);
  }
}
