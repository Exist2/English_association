/**
 * useAssociation Hook - 联想提示逻辑
 *
 * 功能：
 * 1. 对用户输入文本进行 500ms 防抖
 * 2. 防抖后检测语言类型（中文/英文）
 * 3. 调用 POST /api/association 获取联想结果
 * 4. 管理提示面板的显示/隐藏计时器（根据用户配置 3-30 秒后自动隐藏）
 * 5. 新结果到达时替换当前提示并重置计时器
 * 6. AI 服务不可用时显示错误提示
 *
 * 使用方式：
 * const { hints, isLoading, isVisible, error } = useAssociation({
 *   text: editorText,
 *   enabled: isTyping,
 *   hintDuration: theme.hintDuration,
 * });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { associationApi } from '../services/generated';

/** 防抖延迟常量：500 毫秒 */
const DEBOUNCE_DELAY = 500;

/** AI 服务不可用时的错误提示文案 */
const SERVICE_UNAVAILABLE_MESSAGE = '服务暂时不可用，请稍后重试';

/**
 * 联想结果数据结构
 * 每条结果包含文本内容和类型（翻译或联想）
 */
export interface AssociationResult {
  /** 结果唯一标识 */
  id: string;
  /** 联想/翻译文本内容 */
  text: string;
  /** 结果类型：translation=翻译，association=联想 */
  type: 'translation' | 'association';
  /** 置信度（可选），0-1 之间的数值 */
  confidence?: number;
}

/**
 * useAssociation Hook 的配置参数
 */
export interface UseAssociationOptions {
  /** 当前编辑器文本（或最后输入的片段） */
  text: string;
  /** 是否启用联想（例如用户未在输入时设为 false） */
  enabled: boolean;
  /** 提示显示时长（秒），来自主题配置，范围 3-30 */
  hintDuration: number;
}

/**
 * useAssociation Hook 的返回值
 */
export interface UseAssociationReturn {
  /** 当前联想结果列表（最多 5 条） */
  hints: AssociationResult[];
  /** 是否正在调用 API */
  isLoading: boolean;
  /** 提示面板是否应该显示（由计时器控制） */
  isVisible: boolean;
  /** 错误信息（AI 服务不可用时显示） */
  error: string | null;
}

/**
 * 检测文本的语言类型
 *
 * 规则：
 * - 包含中文字符（Unicode 范围 \u4e00-\u9fff）→ 检测为中文
 * - 仅包含英文字母和常见标点 → 检测为英文
 * - 混合文本：以最后一个有意义的字符判断
 *
 * @param text - 待检测的文本
 * @returns 'zh' | 'en' | 'unknown'
 */
function detectLanguage(text: string): 'zh' | 'en' | 'unknown' {
  if (!text.trim()) return 'unknown';

  /**
   * 从文本末尾向前查找最后一个有意义的字符
   * 跳过空格和标点，找到最后输入的实际内容字符
   */
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];

    // 检测中文字符（CJK 统一汉字范围）
    if (/[\u4e00-\u9fff]/.test(char)) {
      return 'zh';
    }

    // 检测英文字母
    if (/[a-zA-Z]/.test(char)) {
      return 'en';
    }
  }

  return 'unknown';
}

/**
 * 判断文本是否满足触发联想的最低长度要求
 *
 * 规则（来自需求 2.1 和 2.2）：
 * - 中文：至少 1 个中文字符
 * - 英文：至少 2 个英文字符
 *
 * @param text - 用户输入文本
 * @param language - 检测到的语言类型
 * @returns 是否满足最低长度要求
 */
function meetsMinimumLength(text: string, language: 'zh' | 'en' | 'unknown'): boolean {
  if (language === 'zh') {
    // 统计中文字符数量
    const chineseChars = text.match(/[\u4e00-\u9fff]/g);
    return (chineseChars?.length ?? 0) >= 1;
  }

  if (language === 'en') {
    // 统计英文字母数量
    const englishChars = text.match(/[a-zA-Z]/g);
    return (englishChars?.length ?? 0) >= 2;
  }

  return false;
}

/**
 * 提取需要传给后端的文本片段
 *
 * 逻辑说明：
 * - 中文模式：从文本末尾向前找到最近一段连续中文文本（遇到英文字母截断）
 *   例如："你好，I'm a 温柔体贴善良大方的女生，并且很爱做饭"
 *   → 提取 "温柔体贴善良大方的女生，并且很爱做饭"
 *   （从最后一个英文字母之后开始，到文本末尾）
 *
 * - 英文模式：将整个段落文本传给后端
 *   因为英文联想需要上下文来理解语义
 *
 * @param text - 完整的输入文本
 * @param language - 检测到的语言类型
 * @returns 需要传给后端的文本片段
 */
function extractRelevantText(text: string, language: 'zh' | 'en' | 'unknown'): string {
  if (language === 'en') {
    // 英文模式：整个段落传给后端（英文联想需要完整上下文）
    return text;
  }

  if (language === 'zh') {
    // 中文模式：从末尾向前找到最近一段连续中文
    // "连续中文"的定义：从最后一个英文字母之后的所有内容（包含中文、标点、数字、空格）
    //
    // 算法：从末尾向前扫描，找到最后一个英文字母的位置，
    // 取该位置之后的所有文本作为"最近一段中文"
    let lastEnglishIndex = -1;

    for (let i = text.length - 1; i >= 0; i--) {
      if (/[a-zA-Z]/.test(text[i])) {
        lastEnglishIndex = i;
        break;
      }
    }

    if (lastEnglishIndex === -1) {
      // 没有英文字母，整段都是中文，全部传给后端
      return text;
    }

    // 取最后一个英文字母之后的部分
    const chineseSegment = text.slice(lastEnglishIndex + 1).trim();

    // 如果截取后为空（比如英文字母在末尾），返回空字符串
    return chineseSegment || '';
  }

  return text;
}

/**
 * useAssociation - 联想提示管理 Hook
 *
 * 核心流程：
 * 1. 用户输入文本 → 防抖 500ms
 * 2. 防抖后文本变化 → 检测语言 → 调用联想 API
 * 3. API 返回结果 → 设置 hints → 显示面板 → 启动隐藏计时器
 * 4. 计时器到期 → 隐藏面板
 * 5. 新结果到达 → 替换 hints → 重置计时器
 *
 * @param options - 配置参数
 * @returns 联想状态（hints、isLoading、isVisible、error）
 */
export function useAssociation(options: UseAssociationOptions): UseAssociationReturn {
  const { text, enabled, hintDuration } = options;

  // ===== 状态管理 =====
  const [hints, setHints] = useState<AssociationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ===== Refs =====

  /**
   * useRef 保存隐藏计时器的引用
   * 用于在新结果到达时取消旧计时器并重置
   */
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * useRef 保存"是否已取消"标记
   * 当用户快速输入时，旧的请求结果应该被忽略，只使用最新请求的结果。
   * 由于生成的 API 客户端不支持 AbortController，这里用标记来忽略过期结果。
   */
  const requestIdRef = useRef(0);

  // 对输入文本进行 500ms 防抖
  const debouncedText = useDebounce(text, DEBOUNCE_DELAY);

  /**
   * 启动隐藏计时器
   * 在 hintDuration 秒后自动隐藏提示面板
   */
  const startHideTimer = useCallback((durationSeconds: number) => {
    // 清除之前的计时器（如果有）
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    // 设置新的计时器
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, durationSeconds * 1000);
  }, []);

  /**
   * 核心 Effect：当防抖后的文本变化时，触发联想请求
   *
   * 依赖项：
   * - debouncedText：防抖后的文本
   * - enabled：是否启用联想
   * - hintDuration：提示显示时长（用于启动计时器）
   */
  useEffect(() => {
    // 如果未启用或文本为空，不触发请求
    if (!enabled || !debouncedText.trim()) {
      return;
    }

    // 检测语言类型
    const language = detectLanguage(debouncedText);

    // 如果无法识别语言，不触发请求
    if (language === 'unknown') {
      return;
    }

    // 检查是否满足最低长度要求
    if (!meetsMinimumLength(debouncedText, language)) {
      return;
    }

    // 提取需要传给后端的文本片段
    // 中文：最近一段连续中文（从最后一个英文字母之后开始）
    // 英文：整个段落
    const textToSend = extractRelevantText(debouncedText, language);

    // 提取后的文本为空或不满足最低长度，不触发请求
    if (!textToSend.trim() || !meetsMinimumLength(textToSend, language)) {
      return;
    }

    /**
     * 递增请求 ID，用于判断响应是否过期
     * 每次发起新请求时 ID +1，响应回来后对比 ID，
     * 如果不一致说明已经有更新的请求发出，当前响应应被忽略
     */
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    /**
     * 异步函数：调用联想 API
     * 使用 async/await 语法处理异步操作
     */
    const fetchAssociation = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await associationApi.getAssociation({
          text: textToSend,
          language,
        });

        // 如果请求已过期（用户又输入了新内容），忽略结果
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // 提取结果，最多取 5 条
        const results: AssociationResult[] = (response.data.results ?? [])
          .slice(0, 5)
          .map((item) => ({
            id: item.id ?? crypto.randomUUID(),
            text: item.text ?? '',
            type: item.type ?? 'association',
            confidence: item.confidence,
          }));

        // 更新状态：设置联想结果
        setHints(results);

        // 如果有结果，显示面板并启动隐藏计时器
        if (results.length > 0) {
          setIsVisible(true);
          startHideTimer(hintDuration);
        }
      } catch (err: unknown) {
        // 如果请求已过期，忽略错误
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        // 如果是 axios 取消的请求，不处理
        if (err instanceof Error && err.name === 'CanceledError') {
          return;
        }

        /**
         * 错误处理：
         * - 503 状态码：AI 服务不可用
         * - 网络错误：无法连接到服务器
         * 统一显示"服务暂时不可用"提示（需求 2.5）
         */
        setError(SERVICE_UNAVAILABLE_MESSAGE);
        setHints([]);
        setIsVisible(true);
        startHideTimer(hintDuration);
      } finally {
        // 只有未过期的请求才更新 loading 状态
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchAssociation();
  }, [debouncedText, enabled, hintDuration, startHideTimer]);

  /**
   * 清理 Effect：组件卸载时清除隐藏计时器
   */
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return {
    hints,
    isLoading,
    isVisible,
    error,
  };
}
