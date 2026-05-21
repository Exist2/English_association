/**
 * 联想服务（AssociationService）
 *
 * 用途：处理文本语言检测和联想/翻译请求的核心业务逻辑。
 * 主要功能：
 * 1. 检测用户输入的语言类型（中文/英文/未知）
 * 2. 中文输入 → 调用 AI 翻译为英文
 * 3. 英文输入 → 调用 AI 获取联想词汇
 * 4. 整合以上逻辑，返回最多5条结果
 *
 * 当前实现使用 Mock 数据，后续接入真实 AI API 时替换 getTranslation 和 getAssociation 方法即可。
 */
import { Injectable } from '@nestjs/common';
import { AssociationResult } from './interfaces';

/**
 * 联想结果数量上限
 * 根据需求 2.1 和 2.2，最多返回5条结果
 */
const MAX_RESULTS = 5;

@Injectable()
export class AssociationService {
  /**
   * 检测文本的语言类型
   *
   * 算法说明：
   * 1. 遍历文本中的每个字符，将文本按语言边界分割成多个片段
   * 2. 中文字符判断：Unicode 范围 \u4e00-\u9fa5（覆盖常用汉字）
   * 3. 英文字符判断：a-z 或 A-Z
   * 4. 如果文本同时包含中文和英文（混合输入），取最后一个语言片段的类型
   *    这是因为用户最后输入的语言代表了当前的意图（需求 2.3）
   * 5. 如果文本中既没有中文也没有英文字符，返回 'unknown'
   *
   * @param text - 用户输入的文本
   * @returns 'zh'（中文）| 'en'（英文）| 'unknown'（无法识别）
   *
   * @example
   * detectLanguage('你好') // 'zh'
   * detectLanguage('hello') // 'en'
   * detectLanguage('你好hello') // 'en'（最后片段是英文）
   * detectLanguage('hello你好') // 'zh'（最后片段是中文）
   * detectLanguage('123!@#') // 'unknown'（没有中英文字符）
   */
  detectLanguage(text: string): 'zh' | 'en' | 'unknown' {
    if (!text || text.trim().length === 0) {
      return 'unknown';
    }

    // 正则表达式：匹配中文字符（Unicode 基本汉字区间）
    const chineseRegex = /[\u4e00-\u9fa5]/;
    // 正则表达式：匹配英文字母
    const englishRegex = /[a-zA-Z]/;

    // 记录最后一个检测到的语言类型
    // 通过从前往后遍历，最终 lastLanguage 就是最后一个语言片段的类型
    let lastLanguage: 'zh' | 'en' | 'unknown' = 'unknown';

    // 遍历每个字符，追踪语言变化
    for (const char of text) {
      if (chineseRegex.test(char)) {
        // 当前字符是中文，更新最后检测到的语言
        lastLanguage = 'zh';
      } else if (englishRegex.test(char)) {
        // 当前字符是英文，更新最后检测到的语言
        lastLanguage = 'en';
      }
      // 其他字符（数字、标点、空格等）不改变语言状态
    }

    return lastLanguage;
  }

  /**
   * 获取中文文本的英文翻译
   *
   * 当前为 Mock 实现，返回模拟的翻译结果。
   * TODO: 接入真实 AI 翻译服务（如 OpenAI、百度翻译 API）
   *
   * @param text - 中文文本
   * @returns 翻译结果数组，最多5条
   *
   * @example
   * await getTranslation('你好') // [{ id: '...', text: 'Hello', type: 'translation' }, ...]
   */
  async getTranslation(text: string): Promise<AssociationResult[]> {
    // TODO: 替换为真实 AI 翻译 API 调用
    // 示例：const response = await this.httpService.post('https://api.openai.com/...', { text });

    // Mock 实现：根据输入文本生成模拟翻译结果
    // 实际项目中这里会调用 AI API 并解析返回的翻译结果
    const mockTranslations: AssociationResult[] = [
      {
        id: this.generateId(),
        text: `[Translation of "${text}"]`,
        type: 'translation',
        confidence: 0.95,
      },
      {
        id: this.generateId(),
        text: `[Alternative translation of "${text}"]`,
        type: 'translation',
        confidence: 0.85,
      },
      {
        id: this.generateId(),
        text: `[Literal translation of "${text}"]`,
        type: 'translation',
        confidence: 0.75,
      },
    ];

    // 确保不超过最大结果数
    return mockTranslations.slice(0, MAX_RESULTS);
  }

  /**
   * 获取英文文本的联想词汇
   *
   * 当前为 Mock 实现，返回模拟的联想结果。
   * TODO: 接入真实 AI 联想服务（如 OpenAI API）
   *
   * @param text - 英文文本
   * @returns 联想结果数组，最多5条
   *
   * @example
   * await getAssociation('hel') // [{ id: '...', text: 'hello', type: 'association' }, ...]
   */
  async getAssociation(text: string): Promise<AssociationResult[]> {
    // TODO: 替换为真实 AI 联想 API 调用
    // 示例：const response = await this.httpService.post('https://api.openai.com/...', { text, mode: 'completion' });

    // Mock 实现：根据输入文本生成模拟联想结果
    // 实际项目中这里会调用 AI API 并解析返回的联想词汇/句子
    const mockAssociations: AssociationResult[] = [
      {
        id: this.generateId(),
        text: `${text}ing`,
        type: 'association',
        confidence: 0.9,
      },
      {
        id: this.generateId(),
        text: `${text}tion`,
        type: 'association',
        confidence: 0.8,
      },
      {
        id: this.generateId(),
        text: `${text} is important`,
        type: 'association',
        confidence: 0.7,
      },
    ];

    // 确保不超过最大结果数
    return mockAssociations.slice(0, MAX_RESULTS);
  }

  /**
   * 处理用户输入，整合语言检测与联想逻辑
   *
   * 流程：
   * 1. 调用 detectLanguage 检测输入语言
   * 2. 根据语言类型调用对应的方法：
   *    - 中文 → getTranslation（获取英文翻译）
   *    - 英文 → getAssociation（获取联想词汇）
   *    - 未知 → 返回空结果
   * 3. 确保结果数量不超过5条
   *
   * @param text - 用户输入的文本
   * @returns 包含联想结果和检测到的语言类型的对象
   */
  async processInput(
    text: string,
  ): Promise<{ results: AssociationResult[]; detectedLanguage: string }> {
    const detectedLanguage = this.detectLanguage(text);

    let results: AssociationResult[] = [];

    switch (detectedLanguage) {
      case 'zh':
        // 中文输入：获取英文翻译
        results = await this.getTranslation(text);
        break;
      case 'en':
        // 英文输入：获取联想词汇
        results = await this.getAssociation(text);
        break;
      case 'unknown':
        // 无法识别：返回空结果（需求 2.4）
        results = [];
        break;
    }

    // 最终保障：确保结果不超过5条（需求 2.1, 2.2）
    return {
      results: results.slice(0, MAX_RESULTS),
      detectedLanguage,
    };
  }

  /**
   * 生成简单的唯一 ID
   *
   * 使用时间戳 + 随机数生成伪唯一 ID。
   * 注意：这不是真正的 UUID，仅用于 Mock 数据。
   * 实际项目中应使用 uuid 库或数据库自动生成。
   *
   * @returns 伪唯一 ID 字符串
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
