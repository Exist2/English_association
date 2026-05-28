/**
 * SaveStatusIndicator 组件 - 保存状态指示器
 *
 * 在编辑器顶部/工具栏区域显示当前文档的保存状态。
 * 根据不同状态显示对应的图标和文案：
 * - idle: 显示"就绪"（淡色，不打扰用户）
 * - saving: 旋转图标 + "保存中..."
 * - saved: 对勾图标 + "已保存" + 相对时间
 * - error: 警告图标 + "保存失败"（红色）
 * - offline: 云断开图标 + "离线"（黄色警告）
 *
 * 使用方式：
 * <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} isOffline={isOffline} />
 */

import { useState, useEffect } from 'react';

// ==================== 类型定义 ====================

/** SaveStatusIndicator 组件的 Props */
export interface SaveStatusIndicatorProps {
  /** 当前保存状态 */
  status: 'idle' | 'saving' | 'saved' | 'error';
  /** 最后成功保存的时间（用于显示相对时间） */
  lastSavedAt: Date | null;
  /** 是否处于离线状态 */
  isOffline: boolean;
}

// ==================== 工具函数 ====================

/**
 * 计算相对时间文案
 * 将时间差转换为人类可读的中文描述，如"刚刚"、"1分钟前"等
 *
 * @param date - 要计算相对时间的日期对象
 * @returns 中文相对时间字符串
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffSeconds < 10) return '刚刚';
  if (diffSeconds < 60) return `${diffSeconds}秒前`;
  if (diffMinutes < 60) return `${diffMinutes}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return '超过一天前';
}

// ==================== 组件实现 ====================

/**
 * SaveStatusIndicator - 保存状态指示器组件
 *
 * 小巧的内联指示器，通过图标和文字告知用户当前保存状态。
 * 使用 CSS transition 实现状态切换时的淡入淡出效果（200ms）。
 *
 * @param props - 包含 status、lastSavedAt、isOffline
 * @returns JSX 元素
 */
export function SaveStatusIndicator({ status, lastSavedAt, isOffline }: SaveStatusIndicatorProps) {
  // 用于定时更新相对时间显示（每 30 秒刷新一次）
  const [, setTick] = useState(0);

  useEffect(() => {
    // 只有在 saved 状态且有 lastSavedAt 时才需要定时刷新
    if (status !== 'saved' || !lastSavedAt) return;

    // 每 30 秒更新一次相对时间显示
    const timer = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 30000);

    return () => clearInterval(timer);
  }, [status, lastSavedAt]);

  // 离线状态优先显示（覆盖其他状态）
  if (isOffline) {
    return (
      <div className="flex items-center gap-1.5 text-xs transition-all duration-200 ease-in-out text-[var(--color-warning)]">
        {/* 云断开图标（SVG） */}
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 2l20 20" />
          <path d="M9.34 9.34a4 4 0 0 0 5.32 5.32" />
          <path d="M17.73 17.73A8 8 0 0 1 5 12.06" />
          <path d="M20.83 12.83A8 8 0 0 0 9.17 5.17" />
        </svg>
        <span>离线</span>
      </div>
    );
  }

  // 根据保存状态渲染不同内容
  switch (status) {
    case 'idle':
      // 空闲状态：显示淡色"就绪"文字
      return (
        <div className="flex items-center gap-1.5 text-xs transition-all duration-200 ease-in-out text-[var(--color-text-muted)]">
          <span>就绪</span>
        </div>
      );

    case 'saving':
      // 保存中：旋转动画图标 + "保存中..."
      return (
        <div className="flex items-center gap-1.5 text-xs transition-all duration-200 ease-in-out text-[var(--color-text-secondary)]">
          {/* 旋转加载图标 - animate-spin 是 Tailwind 内置的旋转动画 */}
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M4.93 4.93l2.83 2.83" />
            <path d="M16.24 16.24l2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="M4.93 19.07l2.83-2.83" />
            <path d="M16.24 7.76l2.83-2.83" />
          </svg>
          <span>保存中...</span>
        </div>
      );

    case 'saved':
      // 已保存：对勾图标 + "已保存" + 相对时间
      return (
        <div className="flex items-center gap-1.5 text-xs transition-all duration-200 ease-in-out text-[var(--color-success)]">
          {/* 对勾图标 */}
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>
            已保存{lastSavedAt ? ` · ${getRelativeTime(lastSavedAt)}` : ''}
          </span>
        </div>
      );

    case 'error':
      // 保存失败：警告图标 + "保存失败"（红色）
      return (
        <div className="flex items-center gap-1.5 text-xs transition-all duration-200 ease-in-out text-[var(--color-error)]">
          {/* 警告三角图标 */}
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>保存失败</span>
        </div>
      );

    default:
      return null;
  }
}
