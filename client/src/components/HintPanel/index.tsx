/**
 * HintPanel 组件 - 联想提示面板
 *
 * 功能：
 * 1. 显示联想/翻译结果列表（最多 5 条）
 * 2. 每条结果显示文本内容和类型标签（翻译/联想）
 * 3. 禁止用户交互（user-select: none + pointer-events: none）
 *    - 用户不能点击、复制、拖拽任何提示文本
 *    - 这是为了强化用户英文记忆（需求 2.6）
 * 4. 加载状态：显示骨架屏动画
 * 5. 错误状态：显示错误提示文字
 * 6. 进入/退出动画：从上方淡入（200ms）
 *
 * 使用方式：
 * <HintPanel
 *   hints={hints}
 *   isVisible={isVisible}
 *   isLoading={isLoading}
 *   error={error}
 * />
 */

import type { AssociationResult } from '../../hooks/useAssociation';

/**
 * HintPanel 组件的 Props 接口
 */
export interface HintPanelProps {
  /** 联想结果列表（最多 5 条） */
  hints: AssociationResult[];
  /** 面板是否可见（由计时器控制） */
  isVisible: boolean;
  /** 是否正在加载 */
  isLoading: boolean;
  /** 错误信息（AI 服务不可用时显示） */
  error: string | null;
}

/**
 * 类型标签映射
 * 将英文类型名转换为中文显示标签
 */
const TYPE_LABELS: Record<AssociationResult['type'], string> = {
  translation: '翻译',
  association: '联想',
};

/**
 * HintPanel - 联想提示面板组件
 *
 * 关键设计决策：
 * - 使用 pointer-events: none 禁止所有鼠标交互
 * - 使用 user-select: none 禁止文本选择和复制
 * - 这两个 CSS 属性确保用户无法通过任何方式获取提示文本
 * - 目的是强化记忆：用户看到提示后需要自己输入，而不是复制粘贴
 *
 * @param props - 组件属性
 */
export function HintPanel({ hints, isVisible, isLoading, error }: HintPanelProps) {
  // 如果面板不可见且不在加载中，不渲染任何内容
  if (!isVisible && !isLoading) {
    return null;
  }

  return (
    <div
      /**
       * 关键样式说明：
       * - select-none: 对应 CSS user-select: none，禁止文本选择
       * - pointer-events-none: 对应 CSS pointer-events: none，禁止所有鼠标事件
       * - 这两个属性组合确保用户无法点击、复制、拖拽面板中的任何内容
       */
      className={`
        select-none pointer-events-none
        mt-2 rounded-lg px-4 py-3
        bg-[var(--color-hint-bg)]
        shadow-[0_2px_8px_rgba(0,0,0,0.04)]
        transition-all duration-200 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}
      `}
    >
      {/* 加载状态：显示骨架屏 */}
      {isLoading && (
        <div className="space-y-2">
          {/* 渲染 3 个骨架条，模拟加载中的内容 */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-5 rounded bg-[var(--color-border)] animate-pulse"
              style={{ width: `${60 + i * 10}%` }}
            />
          ))}
        </div>
      )}

      {/* 错误状态：显示错误提示 */}
      {!isLoading && error && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          {error}
        </p>
      )}

      {/* 正常状态：显示联想结果列表 */}
      {!isLoading && !error && hints.length > 0 && (
        <ul className="space-y-1.5">
          {hints.map((hint) => (
            <li
              key={hint.id}
              className="flex items-center gap-2"
            >
              {/* 类型标签（翻译/联想） */}
              <span
                className="
                  shrink-0 text-xs px-1.5 py-0.5 rounded
                  bg-[var(--color-accent-light)]
                  text-[var(--color-text-secondary)]
                "
              >
                {TYPE_LABELS[hint.type]}
              </span>

              {/* 联想文本内容 */}
              <span className="text-sm text-[var(--color-hint-text)]">
                {hint.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
