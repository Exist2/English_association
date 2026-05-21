/**
 * 主题设置控制器（SettingsController）
 *
 * 用途：处理用户主题配置相关的 HTTP 请求。
 * 提供获取当前主题配置和更新主题配置两个端点。
 *
 * 路由前缀：/api/settings（全局前缀 'api' + 控制器前缀 'settings'）
 *
 * 认证要求：此控制器的所有端点都需要 JWT 认证。
 * 用户必须先登录获取 JWT 令牌，才能读取或修改主题配置。
 *
 * 端点列表：
 * - GET  /api/settings/theme        → 获取当前用户的主题配置
 * - POST /api/settings/theme/update → 更新当前用户的主题配置
 */
import { Controller, Get, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { UpdateThemeDto } from './dto';
import { CurrentUser, UserPayload } from '../../common/decorators/current-user.decorator';
import { ThemeConfig } from './interfaces';

/**
 * 更新主题配置的响应接口
 * @description 定义 POST /api/settings/theme/update 的返回数据结构
 */
interface UpdateThemeResponse {
  /** 操作是否成功 */
  success: boolean;
  /** 更新后的完整主题配置 */
  config: ThemeConfig;
}

/**
 * 主题设置控制器
 * @description 提供主题配置的读取和更新 API 端点，需要 JWT 认证
 */
@ApiTags('设置模块')
@ApiBearerAuth('JWT-auth')
@Controller('settings')
export class SettingsController {
  constructor(
    /** 注入设置服务，处理主题配置的读取和更新逻辑 */
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * 获取当前用户的主题配置
   *
   * 流程：
   * 1. 通过 @CurrentUser() 装饰器获取当前登录用户的信息
   * 2. 调用 SettingsService.getTheme() 查询用户的主题配置
   * 3. 如果用户没有配置记录，返回默认配置（light 主题、16px 字号、5秒提示时长）
   *
   * @param user - 当前登录用户信息（由 JwtAuthGuard 解析 JWT 后注入）
   * @returns 用户的主题配置对象
   */
  @Get('theme')
  @ApiOperation({
    summary: '获取主题配置',
    description: '获取当前登录用户的主题配置，包括主题模式、字号大小和提示显示时长',
  })
  @ApiResponse({
    status: 200,
    description: '成功返回主题配置',
    schema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['light', 'dark'],
          example: 'light',
          description: '主题模式',
        },
        fontSize: {
          type: 'number',
          example: 16,
          description: '字号大小（12-24）',
        },
        hintDuration: {
          type: 'number',
          example: 5,
          description: '提示显示时长（3-30秒）',
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未认证' })
  async getTheme(@CurrentUser() user: UserPayload): Promise<ThemeConfig> {
    // 使用用户 ID（user.sub）查询主题配置
    return this.settingsService.getTheme(user.sub);
  }

  /**
   * 更新当前用户的主题配置
   *
   * 流程：
   * 1. 通过 @CurrentUser() 装饰器获取当前登录用户的信息
   * 2. 请求体经过 UpdateThemeDto 校验（class-validator 自动校验）
   * 3. 调用 SettingsService.updateTheme() 更新配置
   * 4. 返回操作结果和更新后的完整配置
   *
   * 支持部分更新：只传需要修改的字段即可，未传的字段保持不变
   *
   * @param user - 当前登录用户信息（由 JwtAuthGuard 解析 JWT 后注入）
   * @param dto - 要更新的主题配置字段（经过 DTO 校验）
   * @returns 操作结果和更新后的完整主题配置
   */
  @Post('theme/update')
  @ApiOperation({
    summary: '更新主题配置',
    description: '更新当前登录用户的主题配置，支持部分更新（只传需要修改的字段）',
  })
  @ApiBody({ type: UpdateThemeDto, description: '要更新的主题配置字段' })
  @ApiResponse({
    status: 201,
    description: '更新成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        config: {
          type: 'object',
          properties: {
            mode: { type: 'string', enum: ['light', 'dark'], example: 'dark' },
            fontSize: { type: 'number', example: 18 },
            hintDuration: { type: 'number', example: 10 },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未认证' })
  async updateTheme(
    @CurrentUser() user: UserPayload,
    @Body() dto: UpdateThemeDto,
  ): Promise<UpdateThemeResponse> {
    // 调用服务层更新主题配置，传入用户 ID 和校验后的 DTO 数据
    const config = await this.settingsService.updateTheme(user.sub, dto);

    // 返回统一的成功响应格式
    return {
      success: true,
      config,
    };
  }
}
