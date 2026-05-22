/**
 * 编辑器页面组件
 *
 * 应用的核心页面，包含富文本编辑器、联想提示面板、历史记录侧边栏等。
 * 当前为占位实现，后续将集成 Tiptap 编辑器和各功能面板。
 */

/**
 * EditorPage - 编辑器主页面
 * @returns 编辑器页面的 JSX 元素
 */
function EditorPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)]">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
          编辑器页面
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          （占位组件，待实现）
        </p>
      </div>
    </div>
  );
}

export default EditorPage;
