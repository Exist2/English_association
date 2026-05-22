/**
 * useTheme Hook - 主题配置管理
 *
 * 功能：
 * 1. 管理 light/dark 模式切换
 * 2. 管理编辑器字号配置（12-24px）
 * 3. 管理提示显示时长配置（3-30秒）
 * 4. 登录后自动从服务器恢复用户配置
 * 5. 配置变更后自动持久化到服务器（防抖 500ms）
 *
 * 使用方式：
 * const { theme, setMode, setFontSize, setHintDuration, isLoading } = useTheme();
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { settingsApi } from '../services/generated';

/**
 * 主题配置接口
 * 定义了所有可配置的主题属性
 */
export interface ThemeConfig {
  /** 主题模式：明亮 或 暗黑 */
  mode: 'light' | 'dark';
  /** 编辑器字号，范围 12-24px */
  fontSize: number;
  /** 提示显示时长，范围 3-30 秒 */
  hintDuration: number;
}

/**
 * useTheme Hook 返回值接口
 */
export interface UseThemeReturn {
  /** 当前主题配置 */
  theme: ThemeConfig;
  /** 设置主题模式（light/dark） */
  setMode: (mode: 'light' | 'dark') => void;
  /** 设置编辑器字号（12-24px） */
  setFontSize: (size: number) => void;
  /** 设置提示显示时长（3-30秒） */
  setHintDuration: (duration: number) => void;
  /** 是否正在从服务器加载配置 */
  isLoading: boolean;
}

/** 默认主题配置（新用户或未登录时使用） */
const DEFAULT_THEME: ThemeConfig = {
  mode: 'light',
  fontSize: 16,
  hintDuration: 5,
};

/**
 * 将主题模式应用到 DOM
 * 通过在 <html> 元素上添加/移除 .dark 类来切换主题
 *
 * @param mode - 目标主题模式
 */
function applyModeToDOM(mode: 'light' | 'dark'): void {
  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * 将字号应用到 DOM
 * 设置 CSS 变量 --editor-font-size，供编辑器组件引用
 *
 * @param size - 字号值（px）
 */
function applyFontSizeToDOM(size: number): void {
  document.documentElement.style.setProperty('--editor-font-size', `${size}px`);
}

/**
 * useTheme - 主题配置管理 Hook
 *
 * 核心逻辑：
 * 1. 挂载时检查用户是否已登录（localStorage 中有 accessToken）
 * 2. 已登录：从服务器获取主题配置
 * 3. 未登录或获取失败：使用默认配置
 * 4. 配置变更时：立即更新本地状态和 DOM，防抖 500ms 后持久化到服务器
 *
 * @returns UseThemeReturn 主题配置和操作方法
 */
export function useTheme(): UseThemeReturn {
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * useRef 用于保存防抖定时器的引用
   * 这样在组件重新渲染时定时器不会丢失
   */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * useRef 标记是否已完成初始化加载
   * 避免初始化加载时触发不必要的持久化请求
   */
  const isInitializedRef = useRef(false);

  /**
   * 将配置持久化到服务器（防抖 500ms）
   *
   * 为什么用防抖？
   * 用户可能快速拖动滑块，每次变化都触发保存会产生大量请求。
   * 防抖确保只在用户停止操作 500ms 后才发送一次请求。
   *
   * @param config - 要保存的主题配置
   */
  const persistToServer = useCallback((config: ThemeConfig) => {
    // 未登录时不需要持久化
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    // 清除之前的定时器（如果有的话）
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 设置新的 500ms 定时器
    debounceTimerRef.current = setTimeout(async () => {
      try {
        await settingsApi.updateTheme({
          mode: config.mode,
          fontSize: config.fontSize,
          hintDuration: config.hintDuration,
        });
      } catch {
        // 持久化失败时静默处理，不影响用户操作
        // 下次登录时会从服务器重新加载
        console.warn('主题配置持久化失败');
      }
    }, 500);
  }, []);

  /**
   * 挂载时从服务器加载主题配置
   */
  useEffect(() => {
    const loadThemeFromServer = async () => {
      const token = localStorage.getItem('accessToken');

      // 未登录时直接使用默认配置
      if (!token) {
        applyModeToDOM(DEFAULT_THEME.mode);
        applyFontSizeToDOM(DEFAULT_THEME.fontSize);
        isInitializedRef.current = true;
        return;
      }

      setIsLoading(true);
      try {
        const response = await settingsApi.getTheme();
        const serverConfig: ThemeConfig = {
          mode: response.data.mode === 'dark' ? 'dark' : 'light',
          fontSize: Math.min(24, Math.max(12, response.data.fontSize ?? 16)),
          hintDuration: Math.min(30, Math.max(3, response.data.hintDuration ?? 5)),
        };

        setTheme(serverConfig);
        applyModeToDOM(serverConfig.mode);
        applyFontSizeToDOM(serverConfig.fontSize);
      } catch {
        // 获取失败时使用默认配置（需求 6.6）
        applyModeToDOM(DEFAULT_THEME.mode);
        applyFontSizeToDOM(DEFAULT_THEME.fontSize);
      } finally {
        setIsLoading(false);
        isInitializedRef.current = true;
      }
    };

    loadThemeFromServer();

    // 清理：组件卸载时取消未执行的防抖定时器
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * 设置主题模式
   * 立即更新 DOM 和状态，然后防抖持久化
   */
  const setMode = useCallback((mode: 'light' | 'dark') => {
    setTheme((prev) => {
      const newConfig = { ...prev, mode };
      applyModeToDOM(mode);
      if (isInitializedRef.current) {
        persistToServer(newConfig);
      }
      return newConfig;
    });
  }, [persistToServer]);

  /**
   * 设置编辑器字号
   * 范围限制在 12-24px，立即更新 DOM 和状态，然后防抖持久化
   */
  const setFontSize = useCallback((size: number) => {
    // 限制范围在 12-24
    const clampedSize = Math.min(24, Math.max(12, Math.round(size)));
    setTheme((prev) => {
      const newConfig = { ...prev, fontSize: clampedSize };
      applyFontSizeToDOM(clampedSize);
      if (isInitializedRef.current) {
        persistToServer(newConfig);
      }
      return newConfig;
    });
  }, [persistToServer]);

  /**
   * 设置提示显示时长
   * 范围限制在 3-30 秒，立即更新状态，然后防抖持久化
   */
  const setHintDuration = useCallback((duration: number) => {
    // 限制范围在 3-30
    const clampedDuration = Math.min(30, Math.max(3, Math.round(duration)));
    setTheme((prev) => {
      const newConfig = { ...prev, hintDuration: clampedDuration };
      if (isInitializedRef.current) {
        persistToServer(newConfig);
      }
      return newConfig;
    });
  }, [persistToServer]);

  return {
    theme,
    setMode,
    setFontSize,
    setHintDuration,
    isLoading,
  };
}
