/**
 * User 实体单元测试
 *
 * 用途：验证 User 实体的结构和 TypeORM 装饰器元数据是否正确配置。
 * 通过读取 TypeORM 的元数据来确认列名、类型、约束等是否符合设计文档。
 */
import { getMetadataArgsStorage } from 'typeorm';
import { User } from './user.entity';

describe('User Entity', () => {
  it('应该正确定义表名为 users', () => {
    // getMetadataArgsStorage() 返回 TypeORM 收集的所有装饰器元数据
    const tables = getMetadataArgsStorage().tables;
    const userTable = tables.find((t) => t.target === User);
    expect(userTable).toBeDefined();
    expect(userTable!.name).toBe('users');
  });

  it('应该包含所有必需的列', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === User,
    );
    const columnNames = columns.map((c) => c.propertyName);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('phoneEncrypted');
    expect(columnNames).toContain('phoneHash');
    expect(columnNames).toContain('createdAt');
    expect(columnNames).toContain('updatedAt');
  });

  it('phone_hash 列应该设置 unique 约束', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === User,
    );
    const phoneHashCol = columns.find((c) => c.propertyName === 'phoneHash');
    expect(phoneHashCol).toBeDefined();
    expect(phoneHashCol!.options.unique).toBe(true);
  });

  it('应该可以创建 User 实例', () => {
    const user = new User();
    user.id = 'test-uuid';
    user.phoneEncrypted = 'encrypted-value';
    user.phoneHash = 'hash-value';
    user.createdAt = new Date();
    user.updatedAt = new Date();

    expect(user.id).toBe('test-uuid');
    expect(user.phoneEncrypted).toBe('encrypted-value');
    expect(user.phoneHash).toBe('hash-value');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });
});
