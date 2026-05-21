/**
 * 导出控制器（ExportController）
 *
 * 用途：处理文档导出的 HTTP 请求，将文档导出为 Word (.docx) 或 PDF (.pdf) 格式。
 *
 * 路由：POST /api/export/:id
 *
 * 认证要求：
 * - 需要 JWT 认证（通过全局 JwtAuthGuard 保护）
 * - 通过 @CurrentUser() 装饰器获取当前登录用户信息
 *
 * 响应类型：
 * - 不同于其他接口返回 JSON，本接口返回二进制文件流
 * - 通过 Content-Disposition 响应头触发浏览器下载
 * - 通过 Content-Type 响应头告知浏览器文件类型
 *
 * 流程：
 * 1. 校验请求体中的 format 参数（docx 或 pdf）
 * 2. 获取文档信息（标题用于生成文件名）
 * 3. 调用 ExportService 生成文件 Buffer
 * 4. 设置响应头并发送二进制数据
 */
import { Controller, Post, Body, Param, Res } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiParam,
  ApiProduces,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ExportService } from './export.service';
import { DocumentService } from '../document/document.service';
import { ExportDto } from './dto';
import { CurrentUser, UserPayload } from '../../common/decorators';

/**
 * docx 文件的 MIME 类型
 * @description Word 文档的标准 Content-Type 值
 */
const CONTENT_TYPE_DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * pdf 文件的 MIME 类型
 * @description PDF 文档的标准 Content-Type 值
 */
const CONTENT_TYPE_PDF = 'application/pdf';

/**
 * 导出控制器
 * @description 提供文档导出端点，返回二进制文件流触发浏览器下载
 */
@ApiTags('导出模块')
@ApiBearerAuth('JWT-auth')
@Controller('export')
export class ExportController {
  constructor(
    /** 注入导出服务，处理文件生成逻辑 */
    private readonly exportService: ExportService,
    /** 注入文档服务，用于获取文档标题（生成下载文件名） */
    private readonly documentService: DocumentService,
  ) {}

  /**
   * 导出文档
   *
   * 流程：
   * 1. 获取文档信息（主要是标题，用于生成下载文件名）
   * 2. 调用 ExportService.export() 生成文件 Buffer
   * 3. 设置 Content-Type 和 Content-Disposition 响应头
   * 4. 通过 res.send() 发送二进制数据
   *
   * 为什么使用 @Res() 而不是直接 return？
   * - NestJS 默认会将返回值序列化为 JSON
   * - 导出接口需要返回二进制文件流，不是 JSON
   * - 使用 @Res() 可以直接操作 Express 的 Response 对象
   * - 手动设置响应头和发送 Buffer 数据
   *
   * @param user - 当前登录用户信息（从 JWT 中解析）
   * @param id - 要导出的文档 ID（URL 路径参数）
   * @param dto - 导出请求体，包含 format 字段
   * @param res - Express Response 对象，用于手动发送响应
   */
  @Post(':id')
  @ApiOperation({
    summary: '导出文档',
    description: '将指定文档导出为 Word (.docx) 或 PDF (.pdf) 格式，返回二进制文件流',
  })
  @ApiParam({ name: 'id', description: '文档 ID', type: 'string' })
  @ApiBody({ type: ExportDto, description: '导出格式配置' })
  @ApiProduces('application/octet-stream')
  @ApiResponse({
    status: 200,
    description: '导出成功，返回二进制文件流',
    content: {
      'application/octet-stream': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 400, description: '参数校验失败或文档内容为空' })
  @ApiResponse({ status: 401, description: '未认证' })
  @ApiResponse({ status: 404, description: '文档不存在' })
  @ApiResponse({ status: 504, description: '导出超时' })
  async exportDocument(
    @CurrentUser() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: ExportDto,
    @Res() res: Response,
  ): Promise<void> {
    // 步骤1：获取文档信息（标题用于生成下载文件名）
    // DocumentService.findOne 会验证文档归属权，不存在则抛 NotFoundException
    const document = await this.documentService.findOne(user.sub, id);

    // 步骤2：调用导出服务生成文件 Buffer
    // ExportService.export 内部会处理空文档检测和超时控制
    const buffer = await this.exportService.export(id, user.sub, dto.format);

    // 步骤3：根据导出格式确定 Content-Type
    const contentType =
      dto.format === 'docx' ? CONTENT_TYPE_DOCX : CONTENT_TYPE_PDF;

    // 步骤4：生成下载文件名
    // encodeURIComponent 对中文标题进行 URL 编码，确保文件名在 HTTP 头中安全传输
    // 浏览器收到 Content-Disposition: attachment 后会触发下载对话框
    const fileName = `${encodeURIComponent(document.title)}.${dto.format}`;

    // 步骤5：设置响应头并发送文件数据
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  }
}
