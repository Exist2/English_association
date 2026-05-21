/**
 * DocumentService 单元测试
 *
 * 测试策略：
 * - Mock TypeORM Repository（模拟数据库操作）
 * - 测试每个方法的正常流程和异常情况
 * - 验证标题校验、权限校验、分页逻辑等核心行为
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DocumentService } from './document.service';
import { Document } from './entities';

describe('DocumentService', () => {
  let service: DocumentService;

  /**
   * Mock QueryBuilder 对象
   * QueryBuilder 是链式调用的，每个方法都返回 this（即 queryBuilder 自身）
   * 这样可以写 queryBuilder.select(...).where(...).orderBy(...) 的链式语法
   */
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
  };

  /** Mock Repository 对象 */
  const mockDocumentRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  beforeEach(async () => {
    // 创建测试模块，注入 Mock 依赖
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentService,
        {
          provide: getRepositoryToken(Document),
          useValue: mockDocumentRepository,
        },
      ],
    }).compile();

    service = module.get<DocumentService>(DocumentService);

    // 每个测试前重置所有 Mock
    jest.clearAllMocks();
    // 重新设置 QueryBuilder 的链式调用返回值
    mockDocumentRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.skip.mockReturnThis();
    mockQueryBuilder.take.mockReturnThis();
  });

  describe('create（创建文档）', () => {
    const userId = 'user-123';
    const title = '测试文档';
    const content = '{"type":"doc","content":[]}';

    it('应该成功创建文档', async () => {
      const mockDocument = { id: 'doc-1', userId, title, content };
      mockDocumentRepository.create.mockReturnValue(mockDocument);
      mockDocumentRepository.save.mockResolvedValue(mockDocument);

      const result = await service.create(userId, title, content);

      expect(result).toEqual(mockDocument);
      expect(mockDocumentRepository.create).toHaveBeenCalledWith({
        userId,
        title,
        content,
      });
      expect(mockDocumentRepository.save).toHaveBeenCalledWith(mockDocument);
    });

    it('标题为空时应抛出 BadRequestException', async () => {
      await expect(service.create(userId, '', content)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(userId, '', content)).rejects.toThrow(
        '文档标题不能为空',
      );
    });

    it('标题为纯空格时应抛出 BadRequestException', async () => {
      await expect(service.create(userId, '   ', content)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('标题超过50字符时应抛出 BadRequestException', async () => {
      const longTitle = 'a'.repeat(51);
      await expect(service.create(userId, longTitle, content)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(userId, longTitle, content)).rejects.toThrow(
        '文档标题不能超过50个字符',
      );
    });

    it('标题恰好50字符时应成功创建', async () => {
      const exactTitle = 'a'.repeat(50);
      const mockDocument = { id: 'doc-1', userId, title: exactTitle, content };
      mockDocumentRepository.create.mockReturnValue(mockDocument);
      mockDocumentRepository.save.mockResolvedValue(mockDocument);

      const result = await service.create(userId, exactTitle, content);
      expect(result).toEqual(mockDocument);
    });

    it('标题恰好1字符时应成功创建', async () => {
      const singleCharTitle = 'A';
      const mockDocument = { id: 'doc-1', userId, title: singleCharTitle, content };
      mockDocumentRepository.create.mockReturnValue(mockDocument);
      mockDocumentRepository.save.mockResolvedValue(mockDocument);

      const result = await service.create(userId, singleCharTitle, content);
      expect(result).toEqual(mockDocument);
    });

    it('content 为空字符串时应使用空字符串', async () => {
      const mockDocument = { id: 'doc-1', userId, title, content: '' };
      mockDocumentRepository.create.mockReturnValue(mockDocument);
      mockDocumentRepository.save.mockResolvedValue(mockDocument);

      await service.create(userId, title, '');

      expect(mockDocumentRepository.create).toHaveBeenCalledWith({
        userId,
        title,
        content: '',
      });
    });
  });

  describe('findAll（分页查询）', () => {
    const userId = 'user-123';

    it('应该返回分页结果', async () => {
      const mockDocs = [
        { id: 'doc-1', title: '文档1', updatedAt: new Date('2024-01-02') },
        { id: 'doc-2', title: '文档2', updatedAt: new Date('2024-01-01') },
      ];
      mockQueryBuilder.getCount.mockResolvedValue(2);
      mockQueryBuilder.getMany.mockResolvedValue(mockDocs);

      const result = await service.findAll(userId, 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      // 验证只选择了摘要字段
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        'doc.id',
        'doc.title',
        'doc.updatedAt',
      ]);
      // 验证按 updatedAt 降序排列
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('doc.updatedAt', 'DESC');
    });

    it('应该正确计算分页偏移量', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(50);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll(userId, 3, 10);

      // page=3, pageSize=10 → skip(20), take(10)
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('有搜索关键词时应添加 LIKE 条件', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue([
        { id: 'doc-1', title: '英语作文', updatedAt: new Date() },
      ]);

      await service.findAll(userId, 1, 20, '英语');

      // 验证添加了模糊搜索条件
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'LOWER(doc.title) LIKE LOWER(:search)',
        { search: '%英语%' },
      );
    });

    it('搜索关键词为空字符串时不应添加 LIKE 条件', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll(userId, 1, 20, '');

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('搜索关键词为纯空格时不应添加 LIKE 条件', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll(userId, 1, 20, '   ');

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('返回的摘要不应包含 content 字段', async () => {
      const mockDocs = [
        { id: 'doc-1', title: '文档1', updatedAt: new Date() },
      ];
      mockQueryBuilder.getCount.mockResolvedValue(1);
      mockQueryBuilder.getMany.mockResolvedValue(mockDocs);

      const result = await service.findAll(userId, 1, 20);

      // 验证返回的 items 只包含 id、title、updatedAt
      result.items.forEach((item) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('updatedAt');
        expect(item).not.toHaveProperty('content');
        expect(item).not.toHaveProperty('userId');
      });
    });
  });

  describe('findOne（获取单个文档）', () => {
    const userId = 'user-123';
    const docId = 'doc-456';

    it('应该返回文档详情', async () => {
      const mockDocument = {
        id: docId,
        userId,
        title: '测试文档',
        content: '内容',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);

      const result = await service.findOne(userId, docId);

      expect(result).toEqual(mockDocument);
      // 验证查询条件同时包含 id 和 userId（权限校验）
      expect(mockDocumentRepository.findOne).toHaveBeenCalledWith({
        where: { id: docId, userId },
      });
    });

    it('文档不存在时应抛出 NotFoundException', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(userId, docId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(userId, docId)).rejects.toThrow(
        '文档不存在',
      );
    });

    it('文档属于其他用户时应抛出 NotFoundException', async () => {
      // 模拟查询条件不匹配（userId 不同），findOne 返回 null
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('other-user', docId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update（更新文档）', () => {
    const userId = 'user-123';
    const docId = 'doc-456';
    const existingDoc = {
      id: docId,
      userId,
      title: '原标题',
      content: '原内容',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('应该成功更新标题', async () => {
      mockDocumentRepository.findOne.mockResolvedValue({ ...existingDoc });
      mockDocumentRepository.save.mockImplementation((doc) =>
        Promise.resolve(doc),
      );

      const result = await service.update(userId, docId, { title: '新标题' });

      expect(result.title).toBe('新标题');
      expect(mockDocumentRepository.save).toHaveBeenCalled();
    });

    it('应该成功更新内容', async () => {
      mockDocumentRepository.findOne.mockResolvedValue({ ...existingDoc });
      mockDocumentRepository.save.mockImplementation((doc) =>
        Promise.resolve(doc),
      );

      const result = await service.update(userId, docId, { content: '新内容' });

      expect(result.content).toBe('新内容');
    });

    it('应该同时更新标题和内容', async () => {
      mockDocumentRepository.findOne.mockResolvedValue({ ...existingDoc });
      mockDocumentRepository.save.mockImplementation((doc) =>
        Promise.resolve(doc),
      );

      const result = await service.update(userId, docId, {
        title: '新标题',
        content: '新内容',
      });

      expect(result.title).toBe('新标题');
      expect(result.content).toBe('新内容');
    });

    it('更新标题为空时应抛出 BadRequestException', async () => {
      mockDocumentRepository.findOne.mockResolvedValue({ ...existingDoc });

      await expect(
        service.update(userId, docId, { title: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('更新标题超过50字符时应抛出 BadRequestException', async () => {
      mockDocumentRepository.findOne.mockResolvedValue({ ...existingDoc });

      await expect(
        service.update(userId, docId, { title: 'a'.repeat(51) }),
      ).rejects.toThrow(BadRequestException);
    });

    it('文档不存在时应抛出 NotFoundException', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(userId, docId, { title: '新标题' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('不传任何更新字段时应保持原样', async () => {
      mockDocumentRepository.findOne.mockResolvedValue({ ...existingDoc });
      mockDocumentRepository.save.mockImplementation((doc) =>
        Promise.resolve(doc),
      );

      const result = await service.update(userId, docId, {});

      expect(result.title).toBe('原标题');
      expect(result.content).toBe('原内容');
    });
  });

  describe('delete（删除文档）', () => {
    const userId = 'user-123';
    const docId = 'doc-456';

    it('应该成功删除文档', async () => {
      const mockDocument = { id: docId, userId, title: '待删除', content: '' };
      mockDocumentRepository.findOne.mockResolvedValue(mockDocument);
      mockDocumentRepository.remove.mockResolvedValue(mockDocument);

      await expect(service.delete(userId, docId)).resolves.toBeUndefined();
      expect(mockDocumentRepository.remove).toHaveBeenCalledWith(mockDocument);
    });

    it('文档不存在时应抛出 NotFoundException', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(service.delete(userId, docId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('文档属于其他用户时应抛出 NotFoundException', async () => {
      mockDocumentRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('other-user', docId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
