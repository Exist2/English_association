/**
 * 新建文档对话框组件
 *
 * 功能：
 * 1. 弹出模态框让用户输入文档标题
 * 2. 标题长度验证（1-50 字符）
 * 3. 验证失败显示错误提示并阻止创建
 * 4. 支持 Enter 键快速确认、Escape 键取消
 * 5. 打开/关闭时有 200ms 过渡动画（遮罩淡入淡出 + 内容缩放）
 *
 * 使用方式：
 * <CreateDocDialog open={isOpen} onClose={handleClose} onCreate={handleCreate} />
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * CreateDocDialog 组件 Props
 */
export interface CreateDocDialogProps {
  /** 对话框是否打开 */
  open: boolean;
  /** 关闭对话框回调 */
  onClose: () => void;
  /** 创建文档回调，传入标题 */
  onCreate: (title: string) => void;
}

/**
 * CreateDocDialog - 新建文档对话框
 *
 * 动画实现：
 * - 始终渲染 DOM，通过 opacity + scale + pointer-events 控制显隐
 * - 打开时：遮罩淡入 + 内容从 scale(0.95) 放大到 scale(1)
 * - 关闭时：反向动画，200ms 后通过 pointer-events-none 禁止交互
 *
 * 验证规则：
 * - 标题不能为空（去除首尾空格后）
 * - 标题长度不能超过 50 个字符
 *
 * @param props - 组件属性
 */
export function CreateDocDialog({ open, onClose, onCreate }: CreateDocDialogProps) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  /**
   * useRef 保存输入框引用，用于对话框打开时自动聚焦
   */
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * 对话框打开时：清空状态并聚焦输入框
   */
  useEffect(() => {
    if (open) {
      setTitle('');
      setError('');
      // setTimeout 确保 DOM 渲染完成后再聚焦
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  /**
   * 验证标题并提交
   */
  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();

    if (!trimmed) {
      setError('请输入文档标题');
      return;
    }

    if (trimmed.length > 50) {
      setError('标题不能超过 50 个字符');
      return;
    }

    setError('');
    onCreate(trimmed);
    onClose();
  }, [title, onCreate, onClose]);

  /**
   * 键盘事件处理：Enter 确认、Escape 取消
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  return (
    <div
      className={`
        fixed inset-0 z-50 flex items-center justify-center
        ${open ? 'pointer-events-auto' : 'pointer-events-none'}
      `}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-doc-title"
      aria-hidden={!open}
    >
      {/* 遮罩层 */}
      <div
        className={`absolute inset-0 bg-black/40 ${open ? 'opacity-100' : 'opacity-0'}`}
        style={{ transition: 'opacity 200ms linear' }}
      />

      {/* 对话框内容区域 */}
      <div
        className={`
          relative w-full max-w-md mx-4 p-6 rounded-xl bg-[var(--color-bg)] shadow-lg
          origin-center
          ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
        `}
        style={{ transition: 'opacity 200ms linear, transform 200ms linear' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="create-doc-title"
          className="text-lg font-semibold text-[var(--color-text-primary)] mb-4"
        >
          新建文档
        </h2>

        {/* 标题输入框 */}
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError('');
          }}
          onKeyDown={handleKeyDown}
          placeholder="请输入文档标题（1-50 字符）"
          maxLength={50}
          className={`
            w-full px-4 py-2.5 rounded-lg border text-sm
            bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
            placeholder:text-[var(--color-text-muted)]
            focus:outline-none focus:border-[var(--color-border-focus)]
            transition-colors
            ${error ? 'border-[var(--color-error)]' : 'border-[var(--color-border)]'}
          `}
        />

        {/* 错误提示 */}
        {error && (
          <p className="mt-2 text-xs text-[var(--color-error)]">{error}</p>
        )}

        {/* 字符计数 */}
        <p className="mt-1 text-xs text-[var(--color-text-muted)] text-right">
          {title.trim().length}/50
        </p>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--color-accent)] text-white font-medium hover:bg-[var(--color-accent-dark)] transition-colors"
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateDocDialog;
