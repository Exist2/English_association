/**
 * UserSettings 实体单元测试
 *
 * 用途：验证 UserSettings 实体的结构和 TypeORM 装饰器元数据是否正确配置。
 */
import { getMetadataArgsStorage } from 'typeorm';
import { UserSettings } from './user-settings.entity';

describe('UserSettings Entity', () => {
  it('应该正确定义表名为 user_settings', () => {
    const tables = getMetadataArgsStorage().tables;
    const table = tables.find((t) => t.target === UserSettings);
    expect(table).toBeDefined();
    expect(table!.name).toBe('user_settings');
  });

  it('应该包含所有必需的列', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === UserSettings,
    );
    const columnNames = columns.map((c) => c.propertyName);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('userId');
    expect(columnNames).toContain('themeMode');
    expect(columnNames).toContain('fontSize');
    expect(columnNames).toContain('hintDuration');
    expect(columnNames).toContain('updatedAt');
  });

  it('user_id 列应该设置 unique 约束', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === UserSettings,
    );
    const userIdCol = columns.find((c) => c.propertyName === 'userId');
    expect(userIdCol).toBeDefined();
    expect(userIdCol!.options.unique).toBe(true);
  });

  it('theme_mode 列默认值应该为 light', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === UserSettings,
    );
    const themeModeCol = columns.find((c) => c.propertyName === 'themeMode');
    expect(themeModeCol).toBeDefined();
    expect(themeModeCol!.options.default).toBe('light');
  });

  it('font_size 列默认值应该为 16', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === UserSettings,
    );
    const fontSizeCol = columns.find((c) => c.propertyName === 'fontSize');
    expect(fontSizeCol).toBeDefined();
    expect(fontSizeCol!.options.default).toBe(16);
  });

  it('hint_duration 列默认值应该为 5', () => {
    const columns = getMetadataArgsStorage().columns.filter(
      (c) => c.target === UserSettings,
    );
    const hintDurationCol = columns.find(
      (c) => c.propertyName === 'hintDuration',
    );
    expect(hintDurationCol).toBeDefined();
    expect(hintDurationCol!.options.default).toBe(5);
  });

  it('应该定义与 User 的 OneToOne 关系', () => {
    const relations = getMetadataArgsStorage().relations.filter(
      (r) => r.target === UserSettings,
    );
    const userRelation = relations.find((r) => r.propertyName === 'user');
    expect(userRelation).toBeDefined();
    expect(userRelation!.relationType).toBe('one-to-one');
  });

  it('应该可以创建 UserSettings 实例', () => {
    const settings = new UserSettings();
    settings.id = 'test-uuid';
    settings.userId = 'user-uuid';
    settings.themeMode = 'dark';
    settings.fontSize = 18;
    settings.hintDuration = 10;
    settings.updatedAt = new Date();

    expect(settings.themeMode).toBe('dark');
    expect(settings.fontSize).toBe(18);
    expect(settings.hintDuration).toBe(10);
  });
});
