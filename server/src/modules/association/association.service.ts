/**
 * 联想服务（AssociationService）
 *
 * 用途：处理文本语言检测和联想/翻译请求的核心业务逻辑。
 * 主要功能：
 * 1. 检测用户输入的语言类型（中文/英文/未知）
 * 2. 中文输入 → 调用通义千问 AI 翻译为英文
 * 3. 英文输入 → 调用通义千问 AI 获取联想词汇
 * 4. 整合以上逻辑，返回最多5条结果
 *
 * AI 对接方式：
 * 通义千问（Qwen）兼容 OpenAI 协议，使用 openai npm 包调用，
 * 只需将 baseURL 指向阿里云百炼平台的兼容端点即可。
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AssociationResult } from './interfaces';

/**
 * 联想结果数量上限
 * 根据需求 2.1 和 2.2，最多返回5条结果
 */
const MAX_RESULTS = 5;

/**
 * AI 请求超时时间（毫秒）
 * 超过此时间未响应则放弃请求，返回空结果
 */
const AI_TIMEOUT_MS = 8000;

@Injectable()
export class AssociationService {
  private readonly logger = new Logger(AssociationService.name);

  /**
   * OpenAI 客户端实例
   * 通过 OpenAI 兼容协议连接通义千问（Qwen）
   * baseURL 指向阿里云百炼平台的兼容端点
   */
  private openai: OpenAI;

  /** 使用的模型名称（如 qwen-turbo、qwen-plus） */
  private model: string;

  /**
   * 当前进行中的联想/翻译请求的 AbortController
   * - processInput 入口会 abort 掉上一次未完成的请求
   * - 与 8s 超时 abort 协同，保证过期请求不堆积
   */
  private currentController?: AbortController;

  constructor(private configService: ConfigService) {
    /**
     * 初始化 OpenAI 客户端
     *
     * 为什么用 OpenAI SDK 调用通义千问？
     * 因为通义千问提供了 OpenAI 兼容的 API 端点，
     * 这样可以复用成熟的 openai npm 包，无需额外学习新 SDK。
     * 只需要修改 baseURL 和 apiKey 即可。
     */
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('DASHSCOPE_API_KEY'),
      baseURL: this.configService.get<string>(
        'QWEN_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      ),
      // SDK 内置 timeout 作为“网络空闲超时”兑底；
      // 真正的“总耗时 8s”由我们手动的 AbortController 控制（见 requestWithTimeout）。
      timeout: AI_TIMEOUT_MS,
    });

    this.model = this.configService.get<string>('QWEN_MODEL', 'qwen-turbo');
  }

  /**
   * 使用 AbortController 为单次 AI 请求增加 8s 总耗时上限。
   * - 超时或被 abort 时，OpenAI SDK 会拋出 AbortError
   * - 超时/取消场景下统一返回空数组，实现“降级返回空结果”
   */
  private async requestWithTimeout<T>(
    create: (signal: AbortSignal) => Promise<T>,
    logTag: string,
  ): Promise<T | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    this.currentController = controller;
    try {
      return await create(controller.signal);
    } catch (error) {
      const isAbort = this.isAbortError(error);
      if (isAbort) {
        this.logger.warn(
          `[${logTag}] 请求被取消/超时（${AI_TIMEOUT_MS}ms），降级返回空结果`,
        );
      } else {
        this.logger.error(
          `[${logTag}] 请求失败: ${error instanceof Error ? error.message : '未知错误'}`,
        );
      }
      return null;
    } finally {
      clearTimeout(timer);
      if (this.currentController === controller) {
        this.currentController = undefined;
      }
    }
  }

  private isAbortError(error: unknown): boolean {
    if (!error) return false;
    if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
      return error.name === 'AbortError';
    }
    const anyErr = error as { name?: string; code?: string };
    return anyErr?.name === 'AbortError' || anyErr?.code === 'ABORT_ERR';
  }

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
   * 调用通义千问 AI，通过精心设计的 prompt 让模型返回多种翻译方式。
   * 使用较高的 temperature（0.8）以获得多样化的翻译结果。
   *
   * @param text - 中文文本（至少1个中文字符）
   * @returns 翻译结果数组，最多5条
   *
   * @example
   * await getTranslation('你好') // [{ text: 'Hello', ... }, { text: 'Hi there', ... }]
   */
  async getTranslation(text: string): Promise<AssociationResult[]> {
    const response = await this.requestWithTimeout(
      (signal) =>
        this.openai.chat.completions.create(
          {
            model: this.model,
            messages: [
              {
                role: 'system',
                content: `你是一个英语翻译助手。用户输入中文，你需要提供最多5种不同的英文翻译。
要求：
1. 每行一个翻译，不要编号，不要解释
2. 翻译要自然地道，覆盖不同表达方式（正式/口语/简洁等）
3. 只输出英文翻译，不要输出其他内容
4. 如果输入很短（1-2个字），也尽量给出不同语境下的翻译`,
              },
              {
                role: 'user',
                content: text,
              },
            ],
            temperature: 0.8,
            max_tokens: 200,
          },
          { signal },
        ),
      'Translation',
    );

    if (!response) return [];
    const content = response.choices[0]?.message?.content || '';
    return this.parseResults(content, 'translation');
  }

  /**
   * 获取英文文本的联想词汇/句子
   *
   * 调用通义千问 AI，让模型基于用户输入的英文片段进行补全和联想。
   * 使用较高的 temperature（0.9）以获得更有创意的联想结果。
   *
   * @param text - 英文文本（至少2个英文字符）
   * @returns 联想结果数组，最多5条
   *
   * @example
   * await getAssociation('import') // [{ text: 'important', ... }, { text: 'import duty', ... }]
   */
  async getAssociation(text: string): Promise<AssociationResult[]> {
    const response = await this.requestWithTimeout(
      (signal) =>
        this.openai.chat.completions.create(
          {
            model: this.model,
            messages: [
              {
                role: 'system',
                content: `你是一个英语写作助手。用户输入英文单词或短语，你需要提供最多5个相关的英文联想词汇或句子补全。
要求：
1. 每行一个联想结果，不要编号，不要解释
2. 可以是：单词补全、相关短语、包含该词的常用句子
3. 结果要实用，帮助用户扩展写作思路
4. 只输出英文，不要输出中文
5. 优先给出与输入最相关的补全`,
              },
              {
                role: 'user',
                content: text,
              },
            ],
            temperature: 0.9,
            max_tokens: 300,
          },
          { signal },
        ),
      'Association',
    );

    if (!response) return [];
    const content = response.choices[0]?.message?.content || '';
    return this.parseResults(content, 'association');
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
    // 取消上一次未完成的请求，避免过期请求堆积
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = undefined;
    }

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
   * 解析 AI 返回的多行文本为结构化结果数组
   *
   * AI 返回的格式是每行一个结果的纯文本，这里将其转换为 AssociationResult 数组。
   * 同时处理 AI 可能添加的编号前缀（如 "1. "、"1) "、"1、"）。
   *
   * @param content - AI 返回的原始文本
   * @param type - 结果类型（translation 或 association）
   * @returns 结构化的联想结果数组
   */
  private parseResults(
    content: string,
    type: 'translation' | 'association',
  ): AssociationResult[] {
    return content
      .split('\n') // 按行分割
      .map((line) => line.trim()) // 去除首尾空白
      .filter((line) => line.length > 0) // 过滤空行
      .slice(0, MAX_RESULTS) // 最多5条
      .map((line, index) => ({
        id: this.generateId(),
        // 去除 AI 可能添加的编号前缀（如 "1. "、"1) "、"1、"、"- "）
        text: line.replace(/^[\d]+[.\)、]\s*/, '').replace(/^[-•]\s*/, ''),
        type,
        // 按顺序递减置信度（第一条最相关）
        confidence: 1 - index * 0.1,
      }));
  }

  /**
   * 生成简单的唯一 ID
   *
   * 使用时间戳 + 随机数生成伪唯一 ID。
   * 在高并发场景下可能有极小概率重复，但对于联想结果的临时标识足够使用。
   *
   * @returns 伪唯一 ID 字符串
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
