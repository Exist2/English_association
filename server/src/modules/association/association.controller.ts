/**
 * 联想控制器（AssociationController）
 *
 * 用途：处理文本联想/翻译相关的 HTTP 请求。
 * 当用户在编辑器中输入文本后，前端通过此接口获取联想结果。
 *
 * 路由前缀：/api/association（全局前缀 'api' + 控制器前缀 'association'）
 *
 * 认证要求：此控制器的所有端点都需要 JWT 认证（不使用 @Public() 装饰器）。
 * 用户必须先登录获取 JWT 令牌，才能使用联想功能。
 */
import { Controller, Post, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { AssociationService } from './association.service';
import { AssociationDto } from './dto';
import { AssociationResult } from './interfaces';

/**
 * 联想响应接口
 * 定义 POST /api/association 的返回数据结构
 */
interface AssociationResponse {
  /** 联想结果数组，最多5条 */
  results: AssociationResult[];
  /** 检测到的语言类型：'zh'（中文）、'en'（英文）、'unknown'（未知） */
  detectedLanguage: string;
}

/**
 * 联想控制器
 * @description 提供文本联想/翻译的 API 端点，需要 JWT 认证
 */
@ApiTags('联想模块')
@ApiBearerAuth('JWT-auth')
@Controller('association')
export class AssociationController {
  constructor(
    /** 注入联想服务，处理语言检测和联想/翻译的核心逻辑 */
    private readonly associationService: AssociationService,
  ) {}

  /**
   * 处理联想请求
   *
   * 流程：
   * 1. 接收用户输入的文本（经过 DTO 校验确保非空）
   * 2. 调用 AssociationService.processInput() 进行语言检测和联想
   * 3. 返回联想结果和检测到的语言类型
   *
   * 注意：此端点需要 JWT 认证，请求头必须包含有效的 Bearer Token
   *
   * @param dto - 联想请求体，包含用户输入的文本和可选的语言类型
   * @returns 联想结果数组和检测到的语言类型
   */
  @Post()
  @ApiOperation({
    summary: '获取联想/翻译结果',
    description:
      '根据用户输入的文本自动检测语言类型，中文返回英文翻译，英文返回联想词汇。最多返回5条结果。',
  })
  @ApiBody({ type: AssociationDto, description: '联想请求体' })
  @ApiResponse({
    status: 201,
    description: '联想结果',
    schema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '1700000000000-abc1234' },
              text: { type: 'string', example: 'Hello' },
              type: {
                type: 'string',
                enum: ['translation', 'association'],
                example: 'translation',
              },
              confidence: { type: 'number', example: 0.95 },
            },
          },
          description: '联想结果数组，最多5条',
        },
        detectedLanguage: {
          type: 'string',
          enum: ['zh', 'en', 'unknown'],
          example: 'zh',
          description: '检测到的语言类型',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未认证' })
  async getAssociation(
    @Body() dto: AssociationDto,
  ): Promise<AssociationResponse> {
    // 调用服务层处理联想逻辑
    // processInput 内部会自动检测语言类型并返回对应的联想/翻译结果
    return this.associationService.processInput(dto.text);
  }
}
