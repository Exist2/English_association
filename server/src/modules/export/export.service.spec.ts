/**
 * ExportService 单元测试
 *
 * 用途：验证导出服务的核心逻辑，包括：
 * - 空文档检测与拒绝
 * - docx 文件生成（格式保留）
 * - pdf 文件生成（格式保留）
 * - 30 秒超时控制
 * - 文档归属权验证（通过 mock DocumentService）
 *
 * 测试策略：
 * - Mock DocumentService（不依赖真实数据库）
 * - 验证生成的 Buffer 不为空且格式正确
 * - 验证异常场景（空文档、超时、文档不存在）
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, GatewayTimeoutException, NotFoundException } from '@nestjs/common';
import { ExportService } from './export.service';
import { DocumentService } from '../document/document.service';

describe('ExportService', () => {
  let exportService: ExportService;
  let documentService: jest.Mocked<DocumentService>;

  /**
   * 模拟的文档数据
   * 使用 Tiptap JSON 格式的内容
   */
  const mockDocument = {
    id: 'test-doc-id',
    userId: 'test-user-id',
    title: '测试文档',
    content: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '第一章' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '这是一段' },
            { type: 'text', text: '加粗文本', marks: [{ type: 'bold' }] },
            { type: 'text', text: '和' },
            { type: 'text', text: '斜体文本', marks: [{ type: 'italic' }] },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '列表项1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '列表项2' }],
                },
              ],
            },
          ],
        },
      ],
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {} as never,
  };

  beforeEach(async () => {
    // 创建 Mock DocumentService
    const mockDocumentService = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
      ],
    }).compile();

    exportService = module.get<ExportService>(ExportService);
    documentService = module.get(DocumentService) as jest.Mocked<DocumentService>;
  });

  describe('export（统一导出入口）', () => {
    it('应该成功导出 docx 格式', async () => {
      // 模拟 DocumentService 返回文档
      documentService.findOne.mockResolvedValue(mockDocument);

      const result = await exportService.export(
        'test-doc-id',
        'test-user-id',
        'docx',
      );

      // 验证返回的是 Buffer 且不为空
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      // 验证调用了 DocumentService.findOne
      expect(documentService.findOne).toHaveBeenCalledWith(
        'test-user-id',
        'test-doc-id',
      );
    }, 15000);

    it('应该成功导出 pdf 格式', async () => {
      documentService.findOne.mockResolvedValue(mockDocument);

      const result = await exportService.export(
        'test-doc-id',
        'test-user-id',
        'pdf',
      );

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('文档内容为空时应该抛出 BadRequestException', async () => {
      // 模拟返回空内容的文档
      const emptyDocument = {
        ...mockDocument,
        content: '',
      };
      documentService.findOne.mockResolvedValue(emptyDocument);

      await expect(
        exportService.export('test-doc-id', 'test-user-id', 'docx'),
      ).rejects.toThrow(BadRequestException);
    });

    it('文档内容为空 JSON 对象时应该抛出 BadRequestException', async () => {
      const emptyJsonDocument = {
        ...mockDocument,
        content: '{}',
      };
      documentService.findOne.mockResolvedValue(emptyJsonDocument);

      await expect(
        exportService.export('test-doc-id', 'test-user-id', 'pdf'),
      ).rejects.toThrow(BadRequestException);
    });

    it('文档内容为空 Tiptap 文档时应该抛出 BadRequestException', async () => {
      const emptyTiptapDocument = {
        ...mockDocument,
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [] }],
        }),
      };
      documentService.findOne.mockResolvedValue(emptyTiptapDocument);

      await expect(
        exportService.export('test-doc-id', 'test-user-id', 'docx'),
      ).rejects.toThrow(BadRequestException);
    });

    it('文档内容只有空白段落时应该抛出 BadRequestException', async () => {
      const whitespaceDocument = {
        ...mockDocument,
        content: JSON.stringify({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: '   ' }] },
          ],
        }),
      };
      documentService.findOne.mockResolvedValue(whitespaceDocument);

      await expect(
        exportService.export('test-doc-id', 'test-user-id', 'docx'),
      ).rejects.toThrow(BadRequestException);
    });

    it('文档不存在时应该抛出 NotFoundException', async () => {
      documentService.findOne.mockRejectedValue(
        new NotFoundException('文档不存在'),
      );

      await expect(
        exportService.export('non-existent-id', 'test-user-id', 'docx'),
      ).rejects.toThrow(NotFoundException);
    });

    it('导出超时时应该抛出 GatewayTimeoutException', async () => {
      documentService.findOne.mockResolvedValue(mockDocument);

      // Mock exportToDocx 为一个永远不会 resolve 的 Promise
      jest
        .spyOn(exportService, 'exportToDocx')
        .mockReturnValue(new Promise(() => {}));

      // Mock createTimeoutPromise 使其立即 reject（不需要等待真实的 30 秒）
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest
        .spyOn(exportService as any, 'createTimeoutPromise')
        .mockReturnValue(
          new Promise((_, reject) =>
            setTimeout(() => reject(new GatewayTimeoutException('导出超时，请重试')), 10),
          ),
        );

      await expect(
        exportService.export('test-doc-id', 'test-user-id', 'docx'),
      ).rejects.toThrow(GatewayTimeoutException);
    });
  });

  describe('exportToDocx（Word 导出）', () => {
    it('应该生成有效的 docx Buffer', async () => {
      const result = await exportService.exportToDocx({
        title: '测试标题',
        content: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello World' }],
            },
          ],
        }),
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      // docx 文件实际上是 ZIP 格式，前两个字节是 PK (0x50, 0x4B)
      expect(result[0]).toBe(0x50);
      expect(result[1]).toBe(0x4b);
    }, 15000);

    it('应该处理包含格式标记的内容', async () => {
      const result = await exportService.exportToDocx({
        title: '格式测试',
        content: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '普通文本' },
                { type: 'text', text: '加粗', marks: [{ type: 'bold' }] },
                { type: 'text', text: '斜体', marks: [{ type: 'italic' }] },
                {
                  type: 'text',
                  text: '下划线',
                  marks: [{ type: 'underline' }],
                },
              ],
            },
          ],
        }),
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 15000);

    it('应该处理标题节点', async () => {
      const result = await exportService.exportToDocx({
        title: '标题测试',
        content: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: '一级标题' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: '二级标题' }],
            },
          ],
        }),
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 15000);

    it('应该处理列表节点', async () => {
      const result = await exportService.exportToDocx({
        title: '列表测试',
        content: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'orderedList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '第一项' }],
                    },
                  ],
                },
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '第二项' }],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 15000);

    it('应该处理非 JSON 格式的纯文本内容', async () => {
      const result = await exportService.exportToDocx({
        title: '纯文本测试',
        content: '这是一段纯文本内容，不是 JSON 格式',
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('exportToPdf（PDF 导出）', () => {
    it('应该生成有效的 PDF Buffer', async () => {
      const result = await exportService.exportToPdf({
        title: '测试标题',
        content: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Hello World' }],
            },
          ],
        }),
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      // PDF 文件以 %PDF 开头
      const header = result.subarray(0, 4).toString('ascii');
      expect(header).toBe('%PDF');
    });

    it('应该处理包含格式标记的内容', async () => {
      const result = await exportService.exportToPdf({
        title: '格式测试',
        content: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: '普通' },
                { type: 'text', text: '加粗', marks: [{ type: 'bold' }] },
                { type: 'text', text: '斜体', marks: [{ type: 'italic' }] },
              ],
            },
          ],
        }),
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('应该处理标题和列表', async () => {
      const result = await exportService.exportToPdf({
        title: '复杂内容测试',
        content: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: '标题' }],
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '项目一' }],
                    },
                  ],
                },
              ],
            },
          ],
        }),
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('应该处理非 JSON 格式的纯文本内容', async () => {
      const result = await exportService.exportToPdf({
        title: '纯文本',
        content: '这是纯文本内容',
      });

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
