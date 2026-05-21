/**
 * AssociationService 单元测试
 *
 * 测试策略：
 * - detectLanguage：测试纯中文、纯英文、混合输入、特殊字符等各种场景
 * - getTranslation：验证返回结果格式和数量限制
 * - getAssociation：验证返回结果格式和数量限制
 * - processInput：验证整合逻辑（语言检测 → 调用对应方法 → 结果限制）
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AssociationService } from './association.service';

describe('AssociationService', () => {
  let service: AssociationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssociationService],
    }).compile();

    service = module.get<AssociationService>(AssociationService);
  });

  describe('detectLanguage（语言检测）', () => {
    it('纯中文输入应返回 zh', () => {
      expect(service.detectLanguage('你好')).toBe('zh');
      expect(service.detectLanguage('世界')).toBe('zh');
      expect(service.detectLanguage('中文测试')).toBe('zh');
    });

    it('纯英文输入应返回 en', () => {
      expect(service.detectLanguage('hello')).toBe('en');
      expect(service.detectLanguage('World')).toBe('en');
      expect(service.detectLanguage('English Test')).toBe('en');
    });

    it('中文结尾的混合输入应返回 zh', () => {
      expect(service.detectLanguage('hello你好')).toBe('zh');
      expect(service.detectLanguage('test测试')).toBe('zh');
      expect(service.detectLanguage('abc中')).toBe('zh');
    });

    it('英文结尾的混合输入应返回 en', () => {
      expect(service.detectLanguage('你好hello')).toBe('en');
      expect(service.detectLanguage('测试test')).toBe('en');
      expect(service.detectLanguage('中abc')).toBe('en');
    });

    it('纯数字或特殊字符应返回 unknown', () => {
      expect(service.detectLanguage('12345')).toBe('unknown');
      expect(service.detectLanguage('!@#$%')).toBe('unknown');
      expect(service.detectLanguage('123!@#')).toBe('unknown');
    });

    it('空字符串应返回 unknown', () => {
      expect(service.detectLanguage('')).toBe('unknown');
      expect(service.detectLanguage('   ')).toBe('unknown');
    });

    it('中英文之间夹杂数字/符号时，应以最后的语言字符为准', () => {
      // "你好123hello" → 最后语言字符是英文 'o'
      expect(service.detectLanguage('你好123hello')).toBe('en');
      // "hello123你好" → 最后语言字符是中文 '好'
      expect(service.detectLanguage('hello123你好')).toBe('zh');
      // "abc!@#中" → 最后语言字符是中文 '中'
      expect(service.detectLanguage('abc!@#中')).toBe('zh');
    });
  });

  describe('getTranslation（获取翻译）', () => {
    it('应返回翻译结果数组', async () => {
      const results = await service.getTranslation('你好');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('每条结果应包含正确的字段和类型', async () => {
      const results = await service.getTranslation('测试');

      for (const result of results) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('type');
        expect(result.type).toBe('translation');
        expect(typeof result.id).toBe('string');
        expect(typeof result.text).toBe('string');
        expect(result.id.length).toBeGreaterThan(0);
        expect(result.text.length).toBeGreaterThan(0);
      }
    });

    it('confidence 字段应在 0-1 之间', async () => {
      const results = await service.getTranslation('你好');

      for (const result of results) {
        if (result.confidence !== undefined) {
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('getAssociation（获取联想）', () => {
    it('应返回联想结果数组', async () => {
      const results = await service.getAssociation('hello');

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('每条结果应包含正确的字段和类型', async () => {
      const results = await service.getAssociation('test');

      for (const result of results) {
        expect(result).toHaveProperty('id');
        expect(result).toHaveProperty('text');
        expect(result).toHaveProperty('type');
        expect(result.type).toBe('association');
        expect(typeof result.id).toBe('string');
        expect(typeof result.text).toBe('string');
        expect(result.id.length).toBeGreaterThan(0);
        expect(result.text.length).toBeGreaterThan(0);
      }
    });

    it('confidence 字段应在 0-1 之间', async () => {
      const results = await service.getAssociation('hello');

      for (const result of results) {
        if (result.confidence !== undefined) {
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('processInput（处理输入）', () => {
    it('中文输入应返回翻译结果', async () => {
      const { results, detectedLanguage } = await service.processInput('你好世界');

      expect(detectedLanguage).toBe('zh');
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
      for (const result of results) {
        expect(result.type).toBe('translation');
      }
    });

    it('英文输入应返回联想结果', async () => {
      const { results, detectedLanguage } = await service.processInput('hello');

      expect(detectedLanguage).toBe('en');
      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);
      for (const result of results) {
        expect(result.type).toBe('association');
      }
    });

    it('无法识别的输入应返回空结果', async () => {
      const { results, detectedLanguage } = await service.processInput('12345');

      expect(detectedLanguage).toBe('unknown');
      expect(results).toEqual([]);
    });

    it('空字符串应返回空结果', async () => {
      const { results, detectedLanguage } = await service.processInput('');

      expect(detectedLanguage).toBe('unknown');
      expect(results).toEqual([]);
    });

    it('混合输入以最后语言为准', async () => {
      // 以英文结尾 → 联想
      const enResult = await service.processInput('你好hello');
      expect(enResult.detectedLanguage).toBe('en');
      for (const result of enResult.results) {
        expect(result.type).toBe('association');
      }

      // 以中文结尾 → 翻译
      const zhResult = await service.processInput('hello你好');
      expect(zhResult.detectedLanguage).toBe('zh');
      for (const result of zhResult.results) {
        expect(result.type).toBe('translation');
      }
    });

    it('结果数量不应超过5条', async () => {
      const { results: zhResults } = await service.processInput('测试文本');
      expect(zhResults.length).toBeLessThanOrEqual(5);

      const { results: enResults } = await service.processInput('testing');
      expect(enResults.length).toBeLessThanOrEqual(5);
    });
  });
});
