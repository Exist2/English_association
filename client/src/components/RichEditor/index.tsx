/**
 * RichEditor 富文本编辑器组件
 *
 * 基于 Tiptap（ProseMirror）实现，支持：
 * - 加粗、斜体、下划线格式化
 * - H1-H4 标题
 * - 有序/无序列表
 * - 快捷键绑定（Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+U 下划线）
 * - 响应式布局（桌面/平板/移动端适配）
 * - 主题适配（明亮/暗黑模式）
 *
 * 使用方式：
 * <RichEditor content={jsonContent} onChange={handleChange} />
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { useCallback, useEffect } from 'react';
import { Toolbar } from './Toolbar';

/**
 * 编辑器扩展配置（模块级常量）
 *
 * 提取为常量避免每次组件渲染时创建新的数组引用，
 * 确保 useEditor 不会因为引用变化而产生意外行为。
 */
const EDITOR_EXTENSIONS = [
  StarterKit.configure({
    heading: {
      levels: [1, 2, 3, 4],
    },
  }),
  Underline,
  /**
   * TextAlign 扩展：支持文本对齐（左对齐、居中、右对齐、两端对齐）
   * types 指定哪些节点类型支持对齐，这里包含标题和段落
   */
  TextAlign.configure({
    types: ['heading', 'paragraph'],
  }),
];
/**
 * RichEditor 组件的 Props 接口
 */
export interface RichEditorProps {
  /** 编辑器初始内容（Tiptap JSON 格式字符串） */
  content?: string;
  /** 内容变更回调，返回 JSON 格式字符串 */
  onChange?: (content: string) => void;
  /** 是否可编辑，默认 true */
  editable?: boolean;
}

/**
 * RichEditor - 富文本编辑器组件
 *
 * 核心功能：
 * 1. 基于 Tiptap StarterKit 提供基础编辑能力
 * 2. 额外加载 Underline 扩展支持下划线
 * 3. StarterKit 内置了 Heading（H1-H4）、BulletList、OrderedList
 * 4. 快捷键由 Tiptap 扩展自动注册（Ctrl+B/I/U）
 * 5. 通过 CSS 变量适配明亮/暗黑主题
 *
 * @param props - 组件属性
 * @returns 富文本编辑器 JSX 元素
 */
export function RichEditor({ content, onChange, editable = true }: RichEditorProps) {
  /**
   * 内容变更处理函数
   * 将编辑器内容序列化为 JSON 字符串传递给父组件
   */
  const handleUpdate = useCallback(
    ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
      if (!onChange || !editor) return;
      const json = JSON.stringify(editor.getJSON());
      onChange(json);
    },
    [onChange],
  );

  /**
   * useEditor: Tiptap 提供的 React Hook，创建编辑器实例
   *
   * extensions 数组定义了编辑器支持的功能：
   * - StarterKit: 包含段落、加粗、斜体、标题、列表、代码块等基础功能
   * - Underline: 额外的下划线支持（StarterKit 不包含）
   *
   * Heading 配置 levels: [1,2,3,4] 限制只支持 H1-H4
   */
  const editor = useEditor({
    extensions: EDITOR_EXTENSIONS,
    content: content ? JSON.parse(content) : undefined,
    editable,
    onUpdate: handleUpdate,
    /**
     * editorProps 用于自定义编辑器 DOM 属性
     * 设置 class 让编辑区域使用主题变量的字号和颜色
     *
     * h-full：让 prose 容器铺满父级（overflow-y-auto 容器）的高度，
     *        这样无论文档内容多少，整个区域都可点击聚焦输入。
     */
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none h-full px-6 py-4 lg:px-10 lg:py-6',
      },
    },
  });

  /**
   * 当外部 content prop 变化时，同步更新编辑器内容
   *
   * Tiptap 的 useEditor 只在初始化时读取 content 参数，
   * 后续 prop 变化不会自动反映到编辑器中。
   * 需要手动调用 setContent 来更新。
   *
   * emitUpdate: false 防止触发 onUpdate 回调（避免循环更新）
   */
  useEffect(() => {
    if (!editor) return;
    const currentJson = JSON.stringify(editor.getJSON());
    // 只在内容确实不同时才更新，避免光标位置丢失
    if (content && content !== currentJson) {
      editor.commands.setContent(JSON.parse(content), { emitUpdate: false });
    } else if (!content) {
      editor.commands.clearContent();
    }
  }, [editor, content]);

  /**
   * 当外部 editable prop 变化时，同步更新编辑器的可编辑状态
   * 并在变为可编辑时自动聚焦编辑器
   */
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
    // 变为可编辑时自动聚焦，让用户可以直接开始输入
    if (editable) {
      // 使用 setTimeout 确保 DOM 更新完成后再聚焦
      setTimeout(() => {
        editor.commands.focus('end');
      }, 50);
    }
  }, [editor, editable]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-editor)] rounded-lg shadow-[0_1px_3px_var(--shadow-base)]">
      {/* 工具栏 */}
      {editor && <Toolbar editor={editor} />}

      {/* 编辑区域 */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ fontSize: 'var(--editor-font-size, 16px)' }}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export default RichEditor;
