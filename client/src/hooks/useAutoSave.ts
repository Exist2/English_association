/**
 * useAutoSave Hook - 文档自动保存逻辑
 *
 * 核心功能：
 * 1. 防抖自动保存：用户停止输入 2 秒后自动触发保存
 * 2. 手动保存：支持 Ctrl+S / Cmd+S 快捷键立即保存
 * 3. 失败重试：保存失败后 30 秒自动重试
 * 4. 网络检测：监听 online/offline 事件，离线时缓存到 localStorage
 * 5. 网络恢复同步：网络恢复时自动将本地缓存同步到服务器
 * 6. 未保存提示：页面关闭/刷新时通过 beforeunload 提示用户
 *
 * 使用方式：
 * const { saveStatus, lastSavedAt, isOffline, hasUnsavedChanges, triggerSave } = useAutoSave({
 *   documentId: 'xxx',
 *   content: editorContent,
 * });
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { documentApi } from '../services/generated/document';

// ==================== 类型定义 ====================

/** useAutoSave Hook 的配置选项 */
export interface UseAutoSaveOptions {
  /** 当前文档 ID，null 表示尚未加载文档 */
  documentId: string | null;
  /** 当前编辑器内容（JSON 字符串） */
  content: string;
  /** 防抖延迟时间（毫秒），默认 2000ms */
  debounceMs?: number;
  /** 失败重试延迟时间（毫秒），默认 30000ms */
  retryDelayMs?: number;
}

/** useAutoSave Hook 的返回值 */
export interface UseAutoSaveReturn {
  /** 当前保存状态：idle=空闲, saving=保存中, saved=已保存, error=保存失败 */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  /** 最后一次成功保存的时间 */
  lastSavedAt: Date | null;
  /** 当前是否处于离线状态 */
  isOffline: boolean;
  /** 是否有未保存的更改（当前内容 !== 最后成功保存的内容） */
  hasUnsavedChanges: boolean;
  /** 手动触发保存（用于 Ctrl+S），绕过防抖立即保存 */
  triggerSave: () => Promise<void>;
}

// ==================== 常量 ====================

/** 默认防抖延迟：2 秒 */
const DEFAULT_DEBOUNCE_MS = 2000;

/** 默认重试延迟：30 秒 */
const DEFAULT_RETRY_DELAY_MS = 30000;

/** localStorage 缓存 key 前缀 */
const DRAFT_KEY_PREFIX = 'draft:';

// ==================== Hook 实现 ====================

/**
 * useAutoSave - 文档自动保存 Hook
 *
 * @param options - 配置选项，包含 documentId、content、debounceMs、retryDelayMs
 * @returns 保存状态、最后保存时间、离线状态、未保存变更标记、手动保存函数
 *
 * 工作原理：
 * - 使用 useRef 保存"最后成功保存的内容"，与当前 content 对比判断是否有未保存变更
 * - 使用 setTimeout 实现防抖：每次 content 变化时重置计时器，2 秒无变化后触发保存
 * - 使用 navigator.onLine 和 online/offline 事件检测网络状态
 * - 离线时将内容存入 localStorage，网络恢复时自动同步
 */
export function useAutoSave(options: UseAutoSaveOptions): UseAutoSaveReturn {
  const {
    documentId,
    content,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options;

  // ===== 状态管理 =====

  /** 保存状态：idle/saving/saved/error */
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  /** 最后成功保存的时间 */
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  /** 网络是否离线 */
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  // ===== Ref 引用 =====
  // useRef 用于保存不需要触发重新渲染的值，类似于组件的"实例变量"

  /** 最后成功保存到服务器的内容（用于判断 hasUnsavedChanges） */
  const lastSavedContentRef = useRef<string>(content);

  /** 防抖定时器 ID（用于清除上一次的定时器） */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 重试定时器 ID（保存失败后 30 秒重试） */
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 保存最新的 content 值，避免闭包陷阱 */
  const contentRef = useRef<string>(content);

  /** 保存最新的 documentId 值 */
  const documentIdRef = useRef<string | null>(documentId);

  /** 保存最新的 isOffline 值 */
  const isOfflineRef = useRef<boolean>(!navigator.onLine);

  // 同步 ref 值（每次渲染时更新 ref，确保回调函数中拿到最新值）
  contentRef.current = content;
  documentIdRef.current = documentId;
  isOfflineRef.current = isOffline;

  // ===== 计算属性 =====

  /** 判断是否有未保存的更改：当前内容与最后保存内容不同 */
  const hasUnsavedChanges = content !== lastSavedContentRef.current;

  // ===== 核心保存逻辑 =====

  /**
   * 执行保存操作
   *
   * 逻辑：
   * 1. 如果没有 documentId，跳过（文档尚未创建）
   * 2. 如果离线，缓存到 localStorage
   * 3. 如果在线，调用 API 保存到服务器
   * 4. 保存成功：更新 lastSavedContent 和 lastSavedAt
   * 5. 保存失败：设置 error 状态，30 秒后重试
   */
  const performSave = useCallback(async () => {
    const currentDocId = documentIdRef.current;
    const currentContent = contentRef.current;

    // 没有文档 ID 时不执行保存（文档尚未创建）
    if (!currentDocId) return;

    // 如果内容没有变化，不需要保存
    if (currentContent === lastSavedContentRef.current) return;

    // 如果当前离线，缓存到 localStorage
    if (isOfflineRef.current) {
      localStorage.setItem(`${DRAFT_KEY_PREFIX}${currentDocId}`, currentContent);
      return;
    }

    // 在线状态：调用 API 保存到服务器
    setSaveStatus('saving');

    try {
      await documentApi.update(currentDocId, { content: currentContent });

      // 保存成功：更新状态
      lastSavedContentRef.current = currentContent;
      setSaveStatus('saved');
      setLastSavedAt(new Date());

      // 保存成功后清除本地缓存（如果有的话）
      localStorage.removeItem(`${DRAFT_KEY_PREFIX}${currentDocId}`);

      // 清除可能存在的重试定时器
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    } catch {
      // 保存失败：设置错误状态，30 秒后自动重试
      setSaveStatus('error');

      // 清除之前的重试定时器（避免重复重试）
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }

      // 30 秒后自动重试
      retryTimerRef.current = setTimeout(() => {
        performSave();
      }, retryDelayMs);
    }
  }, [retryDelayMs]);

  // ===== 手动保存（Ctrl+S 调用） =====

  /**
   * triggerSave - 立即触发保存，绕过防抖
   * 用于 Ctrl+S / Cmd+S 快捷键场景
   */
  const triggerSave = useCallback(async () => {
    // 清除防抖定时器（因为用户主动保存，不需要再等待）
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    await performSave();
  }, [performSave]);

  // ===== 防抖自动保存：监听 content 变化 =====

  useEffect(() => {
    // 没有文档 ID 时不启动自动保存
    if (!documentId) return;

    // 内容没有变化时不需要保存
    if (content === lastSavedContentRef.current) return;

    // 清除上一次的防抖定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 设置新的防抖定时器：2 秒后触发保存
    // 防抖原理：每次内容变化都重置计时器，只有用户停止输入 2 秒后才真正保存
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, debounceMs);

    // 清理函数：组件卸载或依赖变化时清除定时器
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, documentId, debounceMs, performSave]);

  // ===== Ctrl+S / Cmd+S 快捷键监听 =====

  useEffect(() => {
    /**
     * 键盘事件处理：拦截 Ctrl+S / Cmd+S
     * - event.preventDefault() 阻止浏览器默认的"保存网页"对话框
     * - 立即调用 triggerSave() 执行保存
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      // 检测 Ctrl+S（Windows/Linux）或 Cmd+S（macOS）
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault(); // 阻止浏览器默认保存对话框
        triggerSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // 清理：移除事件监听
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [triggerSave]);

  // ===== 网络状态检测 =====

  useEffect(() => {
    /**
     * 网络恢复时的处理逻辑：
     * 1. 更新离线状态为 false
     * 2. 检查 localStorage 中是否有缓存的草稿
     * 3. 如果有，将缓存内容同步到服务器
     */
    const handleOnline = async () => {
      setIsOffline(false);
      isOfflineRef.current = false;

      // 网络恢复时，检查是否有本地缓存需要同步
      const currentDocId = documentIdRef.current;
      if (!currentDocId) return;

      const cachedContent = localStorage.getItem(`${DRAFT_KEY_PREFIX}${currentDocId}`);
      if (cachedContent) {
        // 有缓存内容，同步到服务器
        setSaveStatus('saving');
        try {
          await documentApi.update(currentDocId, { content: cachedContent });

          // 同步成功：更新状态并清除缓存
          lastSavedContentRef.current = cachedContent;
          setSaveStatus('saved');
          setLastSavedAt(new Date());
          localStorage.removeItem(`${DRAFT_KEY_PREFIX}${currentDocId}`);
        } catch {
          // 同步失败：保留缓存，设置错误状态
          setSaveStatus('error');
        }
      }
    };

    /**
     * 网络断开时的处理逻辑：
     * 1. 更新离线状态为 true
     * 2. 将当前内容缓存到 localStorage（防止数据丢失）
     */
    const handleOffline = () => {
      setIsOffline(true);
      isOfflineRef.current = true;

      // 离线时立即缓存当前内容到 localStorage
      const currentDocId = documentIdRef.current;
      const currentContent = contentRef.current;
      if (currentDocId && currentContent) {
        localStorage.setItem(`${DRAFT_KEY_PREFIX}${currentDocId}`, currentContent);
      }
    };

    // 注册网络状态事件监听
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 清理：移除事件监听
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ===== beforeunload 事件：未保存提示 =====

  useEffect(() => {
    /**
     * beforeunload 事件处理：
     * 当用户关闭/刷新页面且有未保存内容时，浏览器会弹出确认对话框。
     *
     * 注意：现代浏览器不允许自定义提示文案，但设置 event.returnValue
     * 会触发浏览器内置的"你有未保存的更改"提示。
     */
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        // 设置 returnValue 触发浏览器确认对话框
        event.returnValue = '你有未保存的更改，确定要离开吗？';
        return event.returnValue;
      }
    };

    // 只在有未保存更改时注册 beforeunload 事件
    if (hasUnsavedChanges) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    // 清理：移除事件监听
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // ===== 组件卸载时清理所有定时器 =====

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  // ===== 返回值 =====

  return {
    saveStatus,
    lastSavedAt,
    isOffline,
    hasUnsavedChanges,
    triggerSave,
  };
}
