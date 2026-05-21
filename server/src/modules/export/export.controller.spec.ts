/**
 * ExportController 单元测试
 *
 * 测试策略：
 * - Mock ExportService 和 DocumentService，隔离测试控制器逻辑
 * - 验证控制器正确调用 Service 方法并传递正确的参数
 * - 验证响应头（Content-Type、Content-Disposition）设置正确
 * - 验证异常情况下控制器正确传播 Service 抛出的异常
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
} from '@nestjs/common';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { DocumentService } from '../document/document.service';
import { UserPayload } from '../../common/decorators';
import { Response } from 'express';

describe('ExportController', () => {
  let controller: ExportController;
  let exportService: jest.Mocked<ExportService>;
  let documentService: jest.Mocked<DocumentService>;

  /** 模拟的当前用户信息 */
  const mockUser: UserPayload = {
    sub: 'user-uuid-123',
    phoneHash: 'hashed-phone',
  };

  /** 模拟的文档数据 */
  const mockDocument = {
    id: 'doc-uuid-1',
    userId: 'user-uuid-123',
    title: '测试文档',
    content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    user: {} as never,
  };

  /** 创建模拟的 Express Response 对象 */
  const createMockResponse = (): jest.Mocked<Response> => {
    const res = {
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as unknown as jest.Mocked<Response>;
    return res;
  };

  beforeEach(async () => {
    // 创建 Mock 服务
    const mockExportService = {
      export: jest.fn(),
      exportToDocx: jest.fn(),
      exportToPdf: jest.fn(),
    };

    const mockDocumentService = {
      findOne: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExportController],
      providers: [
        {
          provide: ExportService,
          useValue: mockExportService,
        },
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
      ],
    }).compile();

    controller = module.get<ExportController>(ExportController);
    exportService = module.get(ExportService) as jest.Mocked<ExportService>;
    documentService = module.get(DocumentService) as jest.Mocked<DocumentService>;
  });

  describe('exportDocument', () => {
    it('应该成功导出 docx 格式并设置正确的响应头', async () => {
      // 准备：模拟文档查询和导出结果
      const mockBuffer = Buffer.from('fake-docx-content');
      documentService.findOne.mockResolvedValue(mockDocument);
      exportService.export.mockResolvedValue(mockBuffer);

      const res = createMockResponse();

      // 执行
      await controller.exportDocument(
        mockUser,
        'doc-uuid-1',
        { format: 'docx' },
        res,
      );

      // 验证：DocumentService.findOne 被正确调用
      expect(documentService.findOne).toHaveBeenCalledWith(
        'user-uuid-123',
        'doc-uuid-1',
      );

      // 验证：ExportService.export 被正确调用
      expect(exportService.export).toHaveBeenCalledWith(
        'doc-uuid-1',
        'user-uuid-123',
        'docx',
      );

      // 验证：Content-Type 设置为 docx 的 MIME 类型
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );

      // 验证：Content-Disposition 设置为 attachment 并包含编码后的文件名
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent('测试文档')}.docx"`,
      );

      // 验证：发送了 Buffer 数据
      expect(res.send).toHaveBeenCalledWith(mockBuffer);
    });

    it('应该成功导出 pdf 格式并设置正确的响应头', async () => {
      const mockBuffer = Buffer.from('fake-pdf-content');
      documentService.findOne.mockResolvedValue(mockDocument);
      exportService.export.mockResolvedValue(mockBuffer);

      const res = createMockResponse();

      await controller.exportDocument(
        mockUser,
        'doc-uuid-1',
        { format: 'pdf' },
        res,
      );

      // 验证：ExportService.export 使用 pdf 格式调用
      expect(exportService.export).toHaveBeenCalledWith(
        'doc-uuid-1',
        'user-uuid-123',
        'pdf',
      );

      // 验证：Content-Type 设置为 pdf 的 MIME 类型
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );

      // 验证：文件名后缀为 .pdf
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent('测试文档')}.pdf"`,
      );

      expect(res.send).toHaveBeenCalledWith(mockBuffer);
    });

    it('应该对包含特殊字符的标题正确编码文件名', async () => {
      // 模拟标题包含特殊字符（空格、引号等）
      const specialDoc = {
        ...mockDocument,
        title: '我的 "文档" (测试)',
      };
      documentService.findOne.mockResolvedValue(specialDoc);
      exportService.export.mockResolvedValue(Buffer.from('content'));

      const res = createMockResponse();

      await controller.exportDocument(
        mockUser,
        'doc-uuid-1',
        { format: 'docx' },
        res,
      );

      // 验证：文件名被正确 URL 编码
      const expectedFileName = `${encodeURIComponent('我的 "文档" (测试)')}.docx`;
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="${expectedFileName}"`,
      );
    });

    it('应该在文档不存在时传播 NotFoundException', async () => {
      documentService.findOne.mockRejectedValue(
        new NotFoundException('文档不存在'),
      );

      const res = createMockResponse();

      await expect(
        controller.exportDocument(
          mockUser,
          'non-existent-id',
          { format: 'docx' },
          res,
        ),
      ).rejects.toThrow(NotFoundException);

      // 验证：不应该调用导出服务
      expect(exportService.export).not.toHaveBeenCalled();
    });

    it('应该在文档内容为空时传播 BadRequestException', async () => {
      documentService.findOne.mockResolvedValue(mockDocument);
      exportService.export.mockRejectedValue(
        new BadRequestException('文档内容为空，无法导出'),
      );

      const res = createMockResponse();

      await expect(
        controller.exportDocument(
          mockUser,
          'doc-uuid-1',
          { format: 'docx' },
          res,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('应该在导出超时时传播 GatewayTimeoutException', async () => {
      documentService.findOne.mockResolvedValue(mockDocument);
      exportService.export.mockRejectedValue(
        new GatewayTimeoutException('导出超时，请重试'),
      );

      const res = createMockResponse();

      await expect(
        controller.exportDocument(
          mockUser,
          'doc-uuid-1',
          { format: 'pdf' },
          res,
        ),
      ).rejects.toThrow(GatewayTimeoutException);
    });
  });
});
