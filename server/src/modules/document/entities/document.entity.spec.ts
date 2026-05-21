/**
 * Document 实体单元测试
 *
 * 用途：验证 Document 实体的结构和 TypeORM 装饰器元数据是否正确配置。
 */
import { getMetadataArgsStorage } from 'typeorm';
import { Document } from './document.entity';

describe('Document Entity', () => {
  it('应该正确定义表名为 documents', () => {
    const tables = getMetadataArgsStorage().tables;
    const table = tables.find((t) => t.target === Document);
    expect(table).toBeDefined();
    expect(table!.name).toBe('documents');
  });

  it('应该包含所有必需的列', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === Document,
    );
    const columnNames = columns.map((c) => c.propertyName);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('userId');
    expect(columnNames).toContain('title');
    expect(columnNames).toContain('content');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('updatedAt');
  });

  it('title 列长度应该为 50', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === Document,
    );
    const titleCol = columns.find((c) => c.propertyName === 'title');
    expect(titleCol).toBeDefined();
    expect(titleCol!.options.length).toBe(50);
  });

  it('content 列类型应该为 longtext', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === Document,
    );
    const contentCol = columns.find((c) => c.propertyName === 'content');
    expect(contentCol).toBeDefined();
    expect(contentCol!.options.type).toBe('longtext');
  });

  it('应该定义与 User 的 ManyToOne 关系', () => {
    const relations = getMetadataArgsStorage().relations.filter(
      (r) => r.target === Document,
    );
    const userRelation = relations.find((r) => r.propertyName === 'user');
    expect(userRelation).toBeDefined();
    expect(userRelation!.relationType).toBe('many-to-one');
  });

  it('应该可以创建 Document 实例', () => {
    const doc = new Document();
    doc.id = 'test-uuid';
    doc.userId = 'user-uuid';
    doc.title = '测试文档';
    doc.content = '{"type":"doc","content":[]}';
    doc.createdAt = new Date();
    doc.updatedAt = new Date();

    expect(doc.title).toBe('测试文档');
    expect(doc.userId).toBe('user-uuid');
  });
});
