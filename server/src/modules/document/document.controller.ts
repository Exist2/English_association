/**
 * 文档控制器（DocumentController）
 *
 * 用途：处理文档相关的 HTTP 请求，包括创建、列表查询、详情查询、更新和删除。
 *
 * 路由前缀：/api/documents（全局前缀 'api' + 控制器前缀 'documents'）
 *
 * 认证要求：
 * - 所有端点都需要 JWT 认证（不使用 @Public() 装饰器）
 * - 通过 @CurrentUser() 装饰器获取当前登录用户信息
 * - 所有操作都会验证文档归属权（用户只能操作自己的文档）
 *
 * API 设计规则：
 * - 查询操作使用 GET 方法
 * - 所有写操作（创建、更新、删除）使用 POST 方法
 * - 更新路径：POST /api/documents/:id/update
 * - 删除路径：POST /api/documents/:id/delete
 */
import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DocumentService } from './document.service';
import { CreateDocumentDto, UpdateDocumentDto, QueryDocumentDto } from './dto';
import { CurrentUser, UserPayload } from '../../common/decorators';

/**
 * 文档控制器
 * @description 提供文档 CRUD 的 5 个端点，所有操作需要 JWT 认证
 */
@ApiTags('文档模块')
@ApiBearerAuth()
@Controller('documents')
export class DocumentController {
  constructor(
    /** 注入文档服务，处理具体的业务逻辑 */
    private readonly documentService: DocumentService,
  ) {}

  /**
   * 创建文档
   *
   * 流程：验证请求体 → 获取当前用户 → 调用 Service 创建文档
   *
   * @param user - 当前登录用户信息（从 JWT 中解析）
   * @param dto - 创建文档请求体，包含 title 和 content
   * @returns 创建成功的文档基本信息
   */
  @Post()
  @ApiOperation({ summary: '创建文档', description: '创建一个新的文档' })
  @ApiBody({ type: CreateDocumentDto, description: '创建文档请求体' })
  @ApiResponse({
    status: 201,
    description: '创建成功',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-string' },
        title: { type: 'string', example: '我的第一篇文档' },
        createdAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未认证' })
  async create(
    @CurrentUser() user: UserPayload,
    @Body() dto: CreateDocumentDto,
  ): Promise<{ id: string; title: string; createdAt: string }> {
    const document = await this.documentService.create(
      user.sub,
      dto.title,
      dto.content,
    );

    return {
      id: document.id,
      title: document.title,
      createdAt: document.createdAt.toISOString(),
    };
  }

  /**
   * 查询文档列表
   *
   * 支持分页和标题模糊搜索，按最后更新时间降序排列。
   * 只返回文档摘要信息（不包含完整内容），减少数据传输量。
   *
   * @param user - 当前登录用户信息
   * @param query - 查询参数（page、pageSize、search）
   * @returns 分页的文档摘要列表
   */
  @Get()
  @ApiOperation({ summary: '查询文档列表', description: '分页查询当前用户的文档列表，支持标题搜索' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              updatedAt: { type: 'string' },
            },
          },
        },
        total: { type: 'number', example: 50 },
        page: { type: 'number', example: 1 },
        pageSize: { type: 'number', example: 20 },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未认证' })
  async findAll(
    @CurrentUser() user: UserPayload,
    @Query() query: QueryDocumentDto,
  ) {
    return this.documentService.findAll(
      user.sub,
      query.page,
      query.pageSize,
      query.search,
    );
  }

  /**
   * 获取文档详情
   *
   * 返回文档的完整信息（包含 content），用于编辑器加载文档。
   * 会验证文档是否属于当前用户。
   *
   * @param user - 当前登录用户信息
   * @param id - 文档 ID（URL 路径参数）
   * @returns 文档详情
   */
  @Get(':id')
  @ApiOperation({ summary: '获取文档详情', description: '获取指定文档的完整内容' })
  @ApiParam({ name: 'id', description: '文档 ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: '查询成功',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async findOne(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
  ): Promise<{ id: string; title: string; content: string; updatedAt: string }> {
    const document = await this.documentService.findOne(user.sub, id);

    return {
      id: document.id,
      title: document.title,
      content: document.content,
      updatedAt: document.updatedAt.toISOString(),
    };
  }

  /**
   * 更新文档
   *
   * 用于自动保存场景：前端防抖 2 秒后自动调用此接口。
   * 支持部分更新（只更新传入的字段）。
   *
   * @param user - 当前登录用户信息
   * @param id - 文档 ID（URL 路径参数）
   * @param dto - 更新请求体，包含可选的 title 和 content
   * @returns 更新后的文档 ID 和更新时间
   */
  @Post(':id/update')
  @ApiOperation({ summary: '更新文档', description: '更新指定文档的标题和/或内容' })
  @ApiParam({ name: 'id', description: '文档 ID', type: 'string' })
  @ApiBody({ type: UpdateDocumentDto, description: '更新文档请求体' })
  @ApiResponse({
    status: 201,
    description: '更新成功',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数校验失败' })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async update(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<{ id: string; updatedAt: string }> {
    const document = await this.documentService.update(user.sub, id, dto);

    return {
      id: document.id,
      updatedAt: document.updatedAt.toISOString(),
    };
  }

  /**
   * 删除文档
   *
   * 永久删除指定文档。删除前会验证文档归属权。
   *
   * @param user - 当前登录用户信息
   * @param id - 文档 ID（URL 路径参数）
   * @returns 删除结果
   */
  @Post(':id/delete')
  @ApiOperation({ summary: '删除文档', description: '永久删除指定文档' })
  @ApiParam({ name: 'id', description: '文档 ID', type: 'string' })
  @ApiResponse({
    status: 201,
    description: '删除成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  async delete(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.documentService.delete(user.sub, id);

    return { success: true };
  }
}
