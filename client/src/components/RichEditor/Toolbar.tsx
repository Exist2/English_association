/**
 * 编辑器工具栏组件
 *
 * 提供格式化按钮：加粗、斜体、下划线、标题（H1-H4）、有序/无序列表。
 * 按钮状态与编辑器内容同步（当前光标位置的格式会高亮对应按钮）。
 *
 * 快捷键由 Tiptap 扩展自动处理，工具栏只是提供可视化操作入口。
 */

import type { Editor } from '@tiptap/react';

/**
 * Toolbar 组件 Props
 */
interface ToolbarProps {
  /** Tiptap 编辑器实例 */
  editor: Editor;
}

/**
 * 工具栏按钮的通用组件
 * 根据 isActive 状态切换高亮样式
 */
function ToolbarButton({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      className={`
        px-2 py-1.5 rounded text-sm font-medium transition-colors
        ${
          isActive
            ? 'bg-[var(--color-accent-light)] text-[var(--color-accent-dark)]'
            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-light)] hover:text-[var(--color-text-primary)]'
        }
      `}
    >
      {children}
    </button>
  );
}

/**
 * 分隔线组件，用于工具栏按钮分组
 */
function Divider() {
  return <div className="w-px h-5 bg-[var(--color-border)] mx-1" />;
}

/**
 * Toolbar - 编辑器工具栏
 *
 * 按钮分组：
 * 1. 文本格式：加粗、斜体、下划线
 * 2. 标题级别：H1、H2、H3、H4
 * 3. 列表：无序列表、有序列表
 *
 * @param props - 包含 editor 实例
 */
export function Toolbar({ editor }: ToolbarProps) {
  return (
    <div
      className="flex items-center gap-0.5 px-3 py-2 border-b border-[var(--color-border)] flex-wrap"
      role="toolbar"
      aria-label="文本格式化工具栏"
    >
      {/* 文本格式 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="加粗 (Ctrl+B)"
      >
        <strong>B</strong>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="斜体 (Ctrl+I)"
      >
        <em>I</em>
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="下划线 (Ctrl+U)"
      >
        <span className="underline">U</span>
      </ToolbarButton>

      <Divider />

      {/* 标题级别 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="标题 1"
      >
        H1
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="标题 2"
      >
        H2
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        title="标题 3"
      >
        H3
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
        isActive={editor.isActive('heading', { level: 4 })}
        title="标题 4"
      >
        H4
      </ToolbarButton>

      <Divider />

      {/* 列表 */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="无序列表"
      >
        • 列表
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="有序列表"
      >
        1. 列表
      </ToolbarButton>
    </div>
  );
}
