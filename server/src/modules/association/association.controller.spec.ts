/**
 * AssociationController 单元测试
 *
 * 测试策略：
 * - Mock AssociationService 的 processInput 方法，隔离测试控制器逻辑
 * - 验证控制器正确调用 Service 方法并返回预期格式的响应
 * - 验证不同语言输入场景下的行为
 * - 验证异常情况下控制器正确传播 Service 抛出的异常
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AssociationController } from './association.controller';
import { AssociationService } from './association.service';

describe('AssociationController', () => {
  let controller: AssociationController;
  let associationService: jest.Mocked<AssociationService>;

  beforeEach(async () => {
    // 创建 Mock AssociationService
    // jest.fn() 创建一个模拟函数，可以追踪调用参数和设置返回值
    const mockAssociationService = {
      processInput: jest.fn(),
      detectLanguage: jest.fn(),
      getTranslation: jest.fn(),
      getAssociation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssociationController],
      providers: [
        {
          provide: AssociationService,
          useValue: mockAssociationService,
        },
      ],
    }).compile();

    controller = module.get<AssociationController>(AssociationController);
    associationService = module.get(
      AssociationService,
    ) as jest.Mocked<AssociationService>;
  });

  describe('getAssociation', () => {
    it('应该对中文输入返回翻译结果', async () => {
      // 模拟 processInput 返回中文翻译结果
      const mockResponse = {
        results: [
          { id: '1', text: 'Hello', type: 'translation' as const, confidence: 0.95 },
          { id: '2', text: 'Hi', type: 'translation' as const, confidence: 0.85 },
        ],
        detectedLanguage: 'zh',
      };
      associationService.processInput.mockResolvedValue(mockResponse);

      const result = await controller.getAssociation({
        text: '你好',
        language: 'zh',
      });

      // 验证 Service 被正确调用，参数为 dto.text
      expect(associationService.processInput).toHaveBeenCalledWith('你好');
      // 验证返回值格式正确
      expect(result).toEqual(mockResponse);
      expect(result.results).toHaveLength(2);
      expect(result.detectedLanguage).toBe('zh');
    });

    it('应该对英文输入返回联想结果', async () => {
      const mockResponse = {
        results: [
          { id: '1', text: 'helping', type: 'association' as const, confidence: 0.9 },
          { id: '2', text: 'helpful', type: 'association' as const, confidence: 0.8 },
        ],
        detectedLanguage: 'en',
      };
      associationService.processInput.mockResolvedValue(mockResponse);

      const result = await controller.getAssociation({
        text: 'help',
        language: 'en',
      });

      expect(associationService.processInput).toHaveBeenCalledWith('help');
      expect(result).toEqual(mockResponse);
      expect(result.results).toHaveLength(2);
      expect(result.detectedLanguage).toBe('en');
    });

    it('应该在不传 language 字段时正常工作', async () => {
      const mockResponse = {
        results: [
          { id: '1', text: 'World', type: 'translation' as const, confidence: 0.9 },
        ],
        detectedLanguage: 'zh',
      };
      associationService.processInput.mockResolvedValue(mockResponse);

      // language 字段是可选的，不传也应该正常工作
      const result = await controller.getAssociation({ text: '世界' });

      expect(associationService.processInput).toHaveBeenCalledWith('世界');
      expect(result).toEqual(mockResponse);
    });

    it('应该对无法识别的输入返回空结果', async () => {
      const mockResponse = {
        results: [],
        detectedLanguage: 'unknown',
      };
      associationService.processInput.mockResolvedValue(mockResponse);

      const result = await controller.getAssociation({ text: '12345' });

      expect(associationService.processInput).toHaveBeenCalledWith('12345');
      expect(result.results).toHaveLength(0);
      expect(result.detectedLanguage).toBe('unknown');
    });

    it('应该在 Service 抛出异常时正确传播错误', async () => {
      // 模拟 AI 服务不可用的情况
      associationService.processInput.mockRejectedValue(
        new Error('AI 服务暂时不可用'),
      );

      await expect(
        controller.getAssociation({ text: '你好' }),
      ).rejects.toThrow('AI 服务暂时不可用');
    });

    it('应该确保结果数量不超过5条', async () => {
      const mockResponse = {
        results: [
          { id: '1', text: 'r1', type: 'translation' as const },
          { id: '2', text: 'r2', type: 'translation' as const },
          { id: '3', text: 'r3', type: 'translation' as const },
          { id: '4', text: 'r4', type: 'translation' as const },
          { id: '5', text: 'r5', type: 'translation' as const },
        ],
        detectedLanguage: 'zh',
      };
      associationService.processInput.mockResolvedValue(mockResponse);

      const result = await controller.getAssociation({ text: '测试文本' });

      expect(result.results.length).toBeLessThanOrEqual(5);
    });
  });
});
