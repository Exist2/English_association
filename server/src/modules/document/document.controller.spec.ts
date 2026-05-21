/**
 * DocumentController 单元测试
 *
 * 测试策略：
 * - Mock DocumentService 的所有方法，隔离测试控制器逻辑
 * - 验证控制器正确调用 Service 方法并传递正确的参数
 * - 验证控制器返回预期格式的响应（日期转为 ISO 字符串等）
 * - 验证异常情况下控制器正确传播 Service 抛出的异常
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { UserPayload } from '../../common/decorators';

describe('DocumentController', () => {
  let controller: DocumentController;
  let documentService: jest.Mocked<DocumentService>;

  /** 模拟的当前用户信息 */
  const mockUser: UserPayload = {
    sub: 'user-uuid-123',
    phoneHash: 'hashed-phone',
  };

  beforeEach(async () => {
    // 创建 Mock DocumentService
    const mockDocumentService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentController],
      providers: [
        {
          provide: DocumentService,
          useValue: mockDocumentService,
        },
      ],
    }).compile();

    controller = module.get<DocumentController>(DocumentController);
    documentService = module.get(DocumentService) as jest.Mocked<DocumentService>;
  });

  describe('create', () => {
    it('应该成功创建文档并返回格式化的响应', async () => {
      const mockDocument = {
        id: 'doc-uuid-1',
        userId: mockUser.sub,
        title: '测试文档',
        content: '{"type":"doc"}',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        user: {} as never,
      };
      documentService.create.mockResolvedValue(mockDocument);

      const result = await controller.create(mockUser, {
        title: '测试文档',
        content: '{"type":"doc"}',
      });

      expect(documentService.create).toHaveBeenCalledWith(
        'user-uuid-123',
        '测试文档',
        '{"type":"doc"}',
      );
      expect(result).toEqual({
        id: 'doc-uuid-1',
        title: '测试文档',
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    });

    it('应该在标题超长时传播 BadRequestException', async () => {
      documentService.create.mockRejectedValue(
        new BadRequestException('文档标题不能超过50个字符'),
      );

      await expect(
        controller.create(mockUser, {
          title: 'a'.repeat(51),
          content: '',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('应该返回分页的文档列表', async () => {
      const mockResult = {
        items: [
          { id: 'doc-1', title: '文档1', updatedAt: new Date('2024-01-02') },
          { id: 'doc-2', title: '文档2', updatedAt: new Date('2024-01-01') },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
      };
      documentService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockUser, {
        page: 1,
        pageSize: 20,
      });

      expect(documentService.findAll).toHaveBeenCalledWith(
        'user-uuid-123',
        1,
        20,
        undefined,
      );
      expect(result).toEqual(mockResult);
    });

    it('应该支持搜索参数', async () => {
      const mockResult = {
        items: [{ id: 'doc-1', title: '英文学习', updatedAt: new Date() }],
        total: 1,
        page: 1,
        pageSize: 20,
      };
      documentService.findAll.mockResolvedValue(mockResult);

      await controller.findAll(mockUser, {
        page: 1,
        pageSize: 20,
        search: '英文',
      });

      expect(documentService.findAll).toHaveBeenCalledWith(
        'user-uuid-123',
        1,
        20,
        '英文',
      );
    });
  });

  describe('findOne', () => {
    it('应该返回格式化的文档详情', async () => {
      const mockDocument = {
        id: 'doc-uuid-1',
        userId: mockUser.sub,
        title: '测试文档',
        content: '{"type":"doc","content":[]}',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T12:00:00.000Z'),
        user: {} as never,
      };
      documentService.findOne.mockResolvedValue(mockDocument);

      const result = await controller.findOne(mockUser, 'doc-uuid-1');

      expect(documentService.findOne).toHaveBeenCalledWith(
        'user-uuid-123',
        'doc-uuid-1',
      );
      expect(result).toEqual({
        id: 'doc-uuid-1',
        title: '测试文档',
        content: '{"type":"doc","content":[]}',
        updatedAt: '2024-01-02T12:00:00.000Z',
      });
    });

    it('应该在文档不存在时传播 NotFoundException', async () => {
      documentService.findOne.mockRejectedValue(
        new NotFoundException('文档不存在'),
      );

      await expect(
        controller.findOne(mockUser, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('应该成功更新文档并返回格式化的响应', async () => {
      const mockDocument = {
        id: 'doc-uuid-1',
        userId: mockUser.sub,
        title: '更新后的标题',
        content: '新内容',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-03T08:00:00.000Z'),
        user: {} as never,
      };
      documentService.update.mockResolvedValue(mockDocument);

      const result = await controller.update(mockUser, 'doc-uuid-1', {
        title: '更新后的标题',
        content: '新内容',
      });

      expect(documentService.update).toHaveBeenCalledWith(
        'user-uuid-123',
        'doc-uuid-1',
        { title: '更新后的标题', content: '新内容' },
      );
      expect(result).toEqual({
        id: 'doc-uuid-1',
        updatedAt: '2024-01-03T08:00:00.000Z',
      });
    });

    it('应该在文档不存在时传播 NotFoundException', async () => {
      documentService.update.mockRejectedValue(
        new NotFoundException('文档不存在'),
      );

      await expect(
        controller.update(mockUser, 'non-existent-id', { title: '新标题' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('应该在标题为空时传播 BadRequestException', async () => {
      documentService.update.mockRejectedValue(
        new BadRequestException('文档标题不能为空'),
      );

      await expect(
        controller.update(mockUser, 'doc-uuid-1', { title: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('应该成功删除文档并返回 success: true', async () => {
      documentService.delete.mockResolvedValue(undefined);

      const result = await controller.delete(mockUser, 'doc-uuid-1');

      expect(documentService.delete).toHaveBeenCalledWith(
        'user-uuid-123',
        'doc-uuid-1',
      );
      expect(result).toEqual({ success: true });
    });

    it('应该在文档不存在时传播 NotFoundException', async () => {
      documentService.delete.mockRejectedValue(
        new NotFoundException('文档不存在'),
      );

      await expect(
        controller.delete(mockUser, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
