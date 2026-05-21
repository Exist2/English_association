/**
 * 导出模块
 *
 * 用途：将用户文档导出为 Word (.docx) 或 PDF 格式。
 * 导出时保留文档的格式化信息（加粗、斜体、标题、列表等）。
 *
 * 依赖模块：
 * - DocumentModule：提供 DocumentService，用于获取文档数据和验证归属权
 *
 * 提供的服务：
 * - ExportService：文档导出业务逻辑（docx/pdf 生成、超时控制、空文档检测）
 *
 * 控制器：
 * - ExportController：处理 POST /api/export/:id 请求，返回二进制文件流
 */
import { Module } from '@nestjs/common';
import { DocumentModule } from '../document/document.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [
    /**
     * 导入 DocumentModule 以使用 DocumentService
     * DocumentModule 通过 exports 导出了 DocumentService，
     * 所以在这里导入后，ExportService 和 ExportController 都可以注入 DocumentService
     */
    DocumentModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
