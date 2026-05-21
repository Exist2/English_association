/**
 * 文档服务（DocumentService）
 *
 * 用途：处理文档的 CRUD 操作，包括创建、分页查询、获取详情、更新和删除。
 *
 * 核心逻辑：
 * - 所有操作都需要验证文档归属权（userId 校验），确保用户只能操作自己的文档
 * - 创建文档时验证标题长度（1-50 字符）
 * - 分页查询按 updatedAt 降序排列，支持标题模糊搜索
 * - 更新操作用于自动保存场景（防抖触发）
 *
 * 依赖：
 * - TypeORM Repository：数据库 CRUD 操作
 * - QueryBuilder：复杂查询（分页 + 搜索）
 */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities';

/**
 * 文档摘要接口
 * @description 用于列表展示，不包含完整内容（减少数据传输量）
 */
export interface DocumentSummary {
  /** 文档 ID */
  id: string;
  /** 文档标题 */
  title: string;
  /** 最后更新时间 */
  updatedAt: Date;
}

/**
 * 分页查询结果接口
 * @description 统一的分页响应格式
 */
export interface PaginatedResult<T> {
  /** 当前页的数据列表 */
  items: T[];
  /** 符合条件的总记录数 */
  total: number;
  /** 当前页码（从 1 开始） */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

@Injectable()
export class DocumentService {
  constructor(
    /**
     * TypeORM 文档仓库
     * @description 通过 @InjectRepository 注入，提供数据库 CRUD 方法
     * Repository 是 TypeORM 提供的数据访问层，封装了常用的数据库操作
     */
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  /**
   * 创建文档
   *
   * 流程：
   * 1. 验证标题长度（1-50 字符）
   * 2. 创建文档实体并保存到数据库
   *
   * @param userId - 当前登录用户的 ID
   * @param title - 文档标题（1-50 字符）
   * @param content - 文档内容（富文本 JSON 字符串）
   * @returns 创建成功的文档实体
   * @throws BadRequestException 标题为空或超过 50 字符
   */
  async create(userId: string, title: string, content: string): Promise<Document> {
    // 步骤1：验证标题长度
    // trim() 去除首尾空格后再判断，防止用户输入纯空格
    if (!title || title.trim().length === 0) {
      throw new BadRequestException('文档标题不能为空');
    }
    if (title.length > 50) {
      throw new BadRequestException('文档标题不能超过50个字符');
    }

    // 步骤2：创建文档实体
    // repository.create() 只是创建实体对象（不写入数据库）
    // repository.save() 才会真正执行 INSERT 语句
    const document = this.documentRepository.create({
      userId,
      title: title.trim(),
      content: content || '',
    });

    return this.documentRepository.save(document);
  }

  /**
   * 分页查询文档列表
   *
   * 功能：
   * - 按 updatedAt 降序排列（最近修改的排在前面）
   * - 支持按标题模糊搜索（不区分大小写）
   * - 只返回摘要信息（id、title、updatedAt），不返回完整内容
   *
   * @param userId - 当前登录用户的 ID
   * @param page - 页码（从 1 开始）
   * @param pageSize - 每页条数
   * @param search - 可选的搜索关键词（按标题模糊匹配）
   * @returns 分页结果，包含文档摘要列表和总数
   */
  async findAll(
    userId: string,
    page: number,
    pageSize: number,
    search?: string,
  ): Promise<PaginatedResult<DocumentSummary>> {
    // 使用 QueryBuilder 构建复杂查询
    // createQueryBuilder('doc') 中的 'doc' 是表的别名，后续可以用 doc.xxx 引用字段
    const queryBuilder = this.documentRepository
      .createQueryBuilder('doc')
      // 只查询需要的字段（不查询 content，减少数据传输）
      .select(['doc.id', 'doc.title', 'doc.updatedAt'])
      // 只查询当前用户的文档
      .where('doc.userId = :userId', { userId })
      // 按最后更新时间降序排列
      .orderBy('doc.updatedAt', 'DESC');

    // 如果有搜索关键词，添加标题模糊匹配条件
    // LIKE '%keyword%' 表示标题中包含关键词即匹配
    // LOWER() 函数将字符串转为小写，实现不区分大小写的搜索
    if (search && search.trim().length > 0) {
      queryBuilder.andWhere('LOWER(doc.title) LIKE LOWER(:search)', {
        search: `%${search.trim()}%`,
      });
    }

    // 获取符合条件的总记录数（用于前端计算总页数）
    const total = await queryBuilder.getCount();

    // 分页：skip 跳过前面的记录，take 限制返回条数
    // 例如 page=2, pageSize=20 → skip(20), take(20) → 返回第 21-40 条
    const items = await queryBuilder
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    // 将实体映射为摘要格式
    const summaries: DocumentSummary[] = items.map((doc) => ({
      id: doc.id,
      title: doc.title,
      updatedAt: doc.updatedAt,
    }));

    return {
      items: summaries,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取单个文档详情
   *
   * 包含完整内容，用于编辑器加载文档。
   * 会验证文档是否属于当前用户（权限隔离）。
   *
   * @param userId - 当前登录用户的 ID
   * @param docId - 要查询的文档 ID
   * @returns 完整的文档实体（包含 content）
   * @throws NotFoundException 文档不存在或不属于当前用户
   */
  async findOne(userId: string, docId: string): Promise<Document> {
    // findOne 查找单条记录，where 条件同时包含 id 和 userId
    // 这样即使知道别人的文档 ID，也无法访问（因为 userId 不匹配）
    const document = await this.documentRepository.findOne({
      where: { id: docId, userId },
    });

    // 如果找不到文档（不存在或不属于当前用户），返回 404
    if (!document) {
      throw new NotFoundException('文档不存在');
    }

    return document;
  }

  /**
   * 更新文档
   *
   * 用于自动保存场景：用户编辑文档时，前端防抖 2 秒后自动调用此方法。
   * 支持部分更新（只更新传入的字段）。
   *
   * @param userId - 当前登录用户的 ID
   * @param docId - 要更新的文档 ID
   * @param data - 要更新的字段（title 和/或 content）
   * @returns 更新后的文档实体
   * @throws NotFoundException 文档不存在或不属于当前用户
   * @throws BadRequestException 标题为空或超过 50 字符
   */
  async update(
    userId: string,
    docId: string,
    data: Partial<Pick<Document, 'title' | 'content'>>,
  ): Promise<Document> {
    // 步骤1：验证文档存在且属于当前用户
    const document = await this.findOne(userId, docId);

    // 步骤2：如果更新了标题，验证标题长度
    if (data.title !== undefined) {
      if (!data.title || data.title.trim().length === 0) {
        throw new BadRequestException('文档标题不能为空');
      }
      if (data.title.length > 50) {
        throw new BadRequestException('文档标题不能超过50个字符');
      }
      document.title = data.title.trim();
    }

    // 步骤3：如果更新了内容，直接赋值
    if (data.content !== undefined) {
      document.content = data.content;
    }

    // 步骤4：保存更新（TypeORM 会自动更新 updatedAt 字段）
    return this.documentRepository.save(document);
  }

  /**
   * 删除文档
   *
   * 永久删除文档及其关联数据。删除前验证文档归属权。
   *
   * @param userId - 当前登录用户的 ID
   * @param docId - 要删除的文档 ID
   * @throws NotFoundException 文档不存在或不属于当前用户
   */
  async delete(userId: string, docId: string): Promise<void> {
    // 步骤1：验证文档存在且属于当前用户
    const document = await this.findOne(userId, docId);

    // 步骤2：执行删除
    // remove() 会执行 DELETE 语句，彻底从数据库中删除记录
    await this.documentRepository.remove(document);
  }
}
