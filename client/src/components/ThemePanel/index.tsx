/**
 * ThemePanel 组件 - 主题设置面板
 *
 * 功能：
 * 1. 主题模式切换（明亮/暗黑，带图标）
 * 2. 字号滑块调节（12-24px，显示当前值）
 * 3. 提示时长滑块调节（3-30秒，显示当前值）
 * 4. 所有变更即时生效（200ms CSS 过渡动画）
 *
 * 使用方式：
 * <ThemePanel theme={theme} onThemeChange={handleChange} />
 */

import type { ThemeConfig } from '../../hooks/useTheme';

/**
 * ThemePanel 组件的 Props 接口
 */
interface ThemePanelProps {
  /** 当前主题配置 */
  currentTheme: ThemeConfig;
  /** 主题配置变更回调，接收部分配置对象 */
  onThemeChange: (config: Partial<ThemeConfig>) => void;
}

/**
 * ThemePanel - 主题设置面板组件
 *
 * 提供可视化的主题配置界面，包含：
 * - 明亮/暗黑模式切换按钮
 * - 字号大小滑块（12-24px）
 * - 提示显示时长滑块（3-30秒）
 *
 * @param props - 组件属性
 * @param props.currentTheme - 当前主题配置对象
 * @param props.onThemeChange - 配置变更时的回调函数
 */
export function ThemePanel({ currentTheme, onThemeChange }: ThemePanelProps) {
  /**
   * 处理主题模式切换
   * 在 light 和 dark 之间切换
   */
  const handleModeToggle = () => {
    const newMode = currentTheme.mode === 'light' ? 'dark' : 'light';
    onThemeChange({ mode: newMode });
  };

  /**
   * 处理字号滑块变化
   * 将滑块的字符串值转为数字后传递给父组件
   */
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onThemeChange({ fontSize: Number(e.target.value) });
  };

  /**
   * 处理提示时长滑块变化
   * 将滑块的字符串值转为数字后传递给父组件
   */
  const handleHintDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onThemeChange({ hintDuration: Number(e.target.value) });
  };

  return (
    <div className="p-4 rounded-lg bg-(--color-bg-secondary) border border-(--color-border) space-y-5">
      {/* 面板标题 */}
      <h3 className="text-sm font-medium text-(--color-text-primary)">
        外观设置
      </h3>

      {/* 主题模式切换 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-(--color-text-secondary)">主题模式</span>
        <button
          onClick={handleModeToggle}
          className="
            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
            bg-(--color-accent-light) text-(--color-text-primary)
            hover:bg-(--color-accent) hover:text-gray-800
            transition-all duration-200 ease-in-out
            cursor-pointer
          "
          aria-label={`切换到${currentTheme.mode === 'light' ? '暗黑' : '明亮'}模式`}
        >
          {/* 根据当前模式显示对应图标 */}
          {currentTheme.mode === 'light' ? (
            <>
              {/* 太阳图标 - 表示当前为明亮模式 */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>明亮</span>
            </>
          ) : (
            <>
              {/* 月亮图标 - 表示当前为暗黑模式 */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              <span>暗黑</span>
            </>
          )}
        </button>
      </div>

      {/* 字号配置滑块 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-(--color-text-secondary)">编辑器字号</span>
          <span className="text-sm font-medium text-(--color-text-primary)">
            {currentTheme.fontSize}px
          </span>
        </div>
        {/*
          input[type="range"] 滑块组件
          min/max 限制范围为 12-24px
          step=1 表示每次变化 1px
        */}
        <input
          type="range"
          min={12}
          max={24}
          step={1}
          value={currentTheme.fontSize}
          onChange={handleFontSizeChange}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-(--color-border) accent-(--color-accent)"
          aria-label="编辑器字号"
        />
        <div className="flex justify-between text-xs text-(--color-text-muted)">
          <span>12px</span>
          <span>24px</span>
        </div>
      </div>

      {/* 提示时长配置滑块 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-(--color-text-secondary)">提示显示时长</span>
          <span className="text-sm font-medium text-(--color-text-primary)">
            {currentTheme.hintDuration}秒
          </span>
        </div>
        {/*
          input[type="range"] 滑块组件
          min/max 限制范围为 3-30 秒
          step=1 表示每次变化 1 秒
        */}
        <input
          type="range"
          min={3}
          max={30}
          step={1}
          value={currentTheme.hintDuration}
          onChange={handleHintDurationChange}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-(--color-border) accent-(--color-accent)"
          aria-label="提示显示时长"
        />
        <div className="flex justify-between text-xs text-(--color-text-muted)">
          <span>3秒</span>
          <span>30秒</span>
        </div>
      </div>
    </div>
  );
}
