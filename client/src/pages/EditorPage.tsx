/**
 * EditorPage - 编辑器主页面
 *
 * 应用的核心页面，将所有功能组件组装在一起：
 * - 左侧：HistoryPanel（历史记录面板，260px 宽，可折叠）
 * - 中间：RichEditor（富文本编辑器，最大宽度 800px 居中）
 * - 顶部工具栏：汉堡菜单、保存状态、文档标题、主题设置、导出按钮
 * - 编辑器下方：HintPanel（联想提示面板）
 * - 浮层：ThemePanel（主题设置面板）、CreateDocDialog（新建文档对话框）
 *
 * 响应式布局：
 * - 桌面端（≥1024px）：侧边栏常驻，编辑器居中
 * - 平板端（768-1023px）：侧边栏可折叠，编辑器全宽
 * - 移动端（<768px）：侧边栏作为抽屉覆盖，编辑器全宽，工具栏紧凑
 *
 * 数据流：
 * - 用户选择文档 → 加载内容到编辑器
 * - 用户输入 → 更新 editorContent（触发自动保存）+ 更新 lastTypedText（触发联想）
 * - 用户新建文档 → 打开对话框 → 创建后加载新文档
 * - 用户删除文档 → 如果是当前文档则清空编辑器
 */

import { useState, useCallback, useRef } from 'react';
import { RichEditor } from '../components/RichEditor';
import { HintPanel } from '../components/HintPanel';
import { HistoryPanel } from '../components/HistoryPanel';
import { ThemePanel } from '../components/ThemePanel';
import { ExportButton } from '../components/ExportButton';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { CreateDocDialog } from '../components/CreateDocDialog';
import { useTheme } from '../hooks/useTheme';
import { useAutoSave } from '../hooks/useAutoSave';
import { useAssociation } from '../hooks/useAssociation';
import { useDocument } from '../hooks/useDocument';
import { useAuth } from '../hooks/useAuth';
import { documentApi } from '../services/generated/document';

// ==================== 组件实现 ====================

/**
 * EditorPage - 编辑器主页面组件
 *
 * 将 RichEditor、HintPanel、HistoryPanel、ThemePanel、ExportButton、
 * SaveStatusIndicator 组装到一起，并连接所有 Hook。
 *
 * @returns 编辑器页面 JSX 元素
 */
function EditorPage() {
  // ==================== 状态管理 ====================

  /** 当前加载的文档 ID，null 表示没有文档 */
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);

  /** 当前文档标题 */
  const [currentDocTitle, setCurrentDocTitle] = useState<string>('');

  /** 编辑器内容（Tiptap JSON 字符串） */
  const [editorContent, setEditorContent] = useState<string>('');

  /** 历史面板是否折叠 */
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);

  /** 主题设置面板是否打开 */
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);

  /** 新建文档对话框是否打开 */
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  /** 用户最后输入的文本片段（用于触发联想） */
  const [lastTypedText, setLastTypedText] = useState<string>('');

  /**
   * useRef 保存主题面板容器的 DOM 引用
   * 用于点击外部关闭面板
   */
  const themePanelRef = useRef<HTMLDivElement>(null);

  // ==================== Hook 集成 ====================

  /**
   * useTheme - 主题配置管理
   * 提供当前主题配置和修改方法
   */
  const { theme, setMode, setFontSize, setHintDuration } = useTheme();

  /**
   * useAuth - 认证管理
   * 提供退出登录方法
   */
  const { logout } = useAuth();

  /**
   * useAutoSave - 自动保存逻辑
   * 监听 editorContent 变化，防抖 2 秒后自动保存到服务器
   */
  const { saveStatus, lastSavedAt, isOffline } = useAutoSave({
    documentId: currentDocId,
    content: editorContent,
  });

  /**
   * useAssociation - 联想提示逻辑
   * 对 lastTypedText 进行防抖 500ms 后调用联想 API
   * enabled 为 true 表示当前有文档在编辑且有输入文本
   */
  const { hints, isLoading: isHintLoading, isVisible: isHintVisible, error: hintError } = useAssociation({
    text: lastTypedText,
    enabled: !!currentDocId && lastTypedText.length > 0,
    hintDuration: theme.hintDuration,
  });

  /**
   * useDocument - 文档管理
   * 提供文档加载方法（用于从历史面板选择文档后加载内容）
   */
  const { loadDocument } = useDocument();

  // ==================== 事件处理函数 ====================

  /**
   * 处理编辑器内容变更
   * 当用户在编辑器中输入/修改内容时触发
   * 更新 editorContent 状态（会触发 useAutoSave 的防抖保存）
   *
   * @param content - 编辑器内容的 JSON 字符串
   */
  const handleContentChange = useCallback((content: string) => {
    setEditorContent(content);

    /**
     * 从 Tiptap JSON 中提取纯文本
     * Tiptap 的 JSON 格式中，文本内容存储在 content[].content[].text 中
     * 这里简单提取最后一个段落的文本作为联想输入
     */
    try {
      const json = JSON.parse(content);
      // 获取所有段落的文本内容
      const paragraphs = json.content || [];
      // 取最后一个有文本内容的段落
      for (let i = paragraphs.length - 1; i >= 0; i--) {
        const paragraph = paragraphs[i];
        if (paragraph.content && paragraph.content.length > 0) {
          // 拼接段落内所有文本节点
          const text = paragraph.content
            .filter((node: { type: string }) => node.type === 'text')
            .map((node: { text: string }) => node.text || '')
            .join('');
          if (text.trim()) {
            setLastTypedText(text);
            return;
          }
        }
      }
      // 没有找到文本内容
      setLastTypedText('');
    } catch {
      // JSON 解析失败时不更新联想文本
      setLastTypedText('');
    }
  }, []);

  /**
   * 处理从历史面板选择文档
   * 加载选中文档的内容到编辑器
   *
   * @param docId - 选中的文档 ID
   */
  const handleDocumentSelect = useCallback(async (docId: string) => {
    try {
      const doc = await loadDocument(docId);
      setCurrentDocId(docId);
      setCurrentDocTitle(doc.title);
      setEditorContent(doc.content);
      setLastTypedText('');
    } catch {
      // loadDocument 内部已处理错误，这里不需要额外操作
    }
  }, [loadDocument]);

  /**
   * 处理删除文档
   * 如果删除的是当前正在编辑的文档，清空编辑器
   *
   * @param docId - 被删除的文档 ID
   */
  const handleDocumentDelete = useCallback((docId: string) => {
    if (docId === currentDocId) {
      // 当前文档被删除，清空编辑器状态
      setCurrentDocId(null);
      setCurrentDocTitle('');
      setEditorContent('');
      setLastTypedText('');
    }
  }, [currentDocId]);

  /**
   * 处理新建文档
   * 调用 API 创建文档，然后加载新文档到编辑器
   *
   * @param title - 用户输入的文档标题
   */
  const handleCreateDocument = useCallback(async (title: string) => {
    try {
      // 调用创建文档 API，初始内容为空
      const response = await documentApi.create({ title, content: '' });
      const newDocId = response.data.id;

      if (newDocId) {
        // 创建成功，设置为当前文档
        setCurrentDocId(newDocId);
        setCurrentDocTitle(title);
        setEditorContent('');
        setLastTypedText('');
      }
    } catch {
      // 创建失败，静默处理（可以后续添加 Toast 提示）
      console.error('创建文档失败');
    }
  }, []);

  /**
   * 处理主题配置变更
   * ThemePanel 组件通过此回调传递部分配置更新
   *
   * @param config - 部分主题配置对象
   */
  const handleThemeChange = useCallback((config: Partial<typeof theme>) => {
    if (config.mode !== undefined) setMode(config.mode);
    if (config.fontSize !== undefined) setFontSize(config.fontSize);
    if (config.hintDuration !== undefined) setHintDuration(config.hintDuration);
  }, [setMode, setFontSize, setHintDuration]);

  /**
   * 切换历史面板折叠状态
   */
  const handleToggleHistory = useCallback(() => {
    setIsHistoryCollapsed((prev) => !prev);
  }, []);

  /**
   * 切换主题设置面板显示/隐藏
   */
  const handleToggleThemePanel = useCallback(() => {
    setIsThemePanelOpen((prev) => !prev);
  }, []);

  // ==================== 渲染 ====================

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden">
      {/* ===== 移动端遮罩层 ===== */}
      {/* 当侧边栏展开且在移动端/平板端时，显示半透明遮罩 */}
      {!isHistoryCollapsed && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={handleToggleHistory}
          aria-hidden="true"
        />
      )}

      {/* ===== 左侧：历史记录面板 ===== */}
      <HistoryPanel
        isCollapsed={isHistoryCollapsed}
        onToggleCollapse={handleToggleHistory}
        onDocumentSelect={handleDocumentSelect}
        onDocumentDelete={handleDocumentDelete}
        currentDocId={currentDocId}
      />

      {/* ===== 右侧：主内容区域 =====
       * 使用 --color-bg-content（略深于页面主背景），与左侧历史面板（--color-bg-secondary）形成视觉分层
       */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--color-bg-content)]">
        {/* ----- 顶部工具栏 ----- */}
        <header className="
          flex items-center justify-between
          h-12 px-4 shrink-0
          border-b border-[var(--color-border)]
          bg-[var(--color-bg-content)]
        ">
          {/* 左侧：汉堡菜单 + 保存状态 */}
          <div className="flex items-center gap-3">
            {/* 汉堡菜单按钮（展开/折叠历史面板） */}
            <button
              onClick={handleToggleHistory}
              className="
                p-1.5 rounded-md
                hover:bg-[var(--color-accent-light)]
                transition-colors duration-100
              "
              aria-label={isHistoryCollapsed ? '展开历史记录' : '折叠历史记录'}
              title={isHistoryCollapsed ? '展开历史记录' : '折叠历史记录'}
            >
              {/* 汉堡菜单图标（三条横线） */}
              <svg
                className="w-5 h-5 text-[var(--color-text-secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* 保存状态指示器 */}
            <SaveStatusIndicator
              status={saveStatus}
              lastSavedAt={lastSavedAt}
              isOffline={isOffline}
            />
          </div>

          {/* 中间：文档标题 */}
          <div className="flex-1 text-center px-4 truncate">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {currentDocTitle || '未选择文档'}
            </span>
          </div>

          {/* 右侧：新建文档 + 主题设置 + 导出按钮 */}
          <div className="flex items-center gap-2">
            {/* 新建文档按钮 */}
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="
                p-1.5 rounded-md
                hover:bg-[var(--color-accent-light)]
                transition-colors duration-100
              "
              aria-label="新建文档"
              title="新建文档"
            >
              {/* 加号图标 */}
              <svg
                className="w-5 h-5 text-[var(--color-text-secondary)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>

            {/* 主题设置按钮 */}
            <div className="relative" ref={themePanelRef}>
              <button
                onClick={handleToggleThemePanel}
                className="
                  p-1.5 rounded-md
                  hover:bg-[var(--color-accent-light)]
                  transition-colors duration-100
                "
                aria-label="主题设置"
                title="主题设置"
              >
                {/* 齿轮图标 */}
                <svg
                  className="w-5 h-5 text-[var(--color-text-secondary)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* 主题设置面板（下拉浮层） */}
              {isThemePanelOpen && (
                <div className="
                  absolute right-0 top-full mt-2 z-50
                  w-72
                  animate-[fadeIn_200ms_ease-out]
                ">
                  <ThemePanel
                    currentTheme={theme}
                    onThemeChange={handleThemeChange}
                    onLogout={logout}
                  />
                </div>
              )}
            </div>

            {/* 导出按钮 */}
            <ExportButton
              documentId={currentDocId}
              isContentEmpty={!editorContent}
            />
          </div>
        </header>

        {/* ----- 编辑器主体区域 -----
         * 布局说明：
         * - main 使用 flex-col 纵向铺满（flex-1 + min-h-0 让滚动容器正确生效）
         * - 左右内边距 130px（桌面端）；移动端/平板回退到较小值，避免窗口过窄时编辑区宽度不足
         * - 编辑器外层 wrapper 设为 flex-col，RichEditor 通过 flex-1 + min-h-0 上下铺满
         * - HistoryPanel 折叠/展开 或 窗口尺寸变化时，main 因为是 flex-1 兄弟元素，宽度会自动重算，
         *   所以编辑区无需额外计算即可自适应
         */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col px-4 md:px-16 lg:px-[130px]">
            {/* 富文本编辑器：flex-1 占满剩余高度，min-h-0 防止 flex 子项被内容撑高 */}
            <div className="flex-1 min-h-0">
              <RichEditor
                content={editorContent || undefined}
                onChange={handleContentChange}
                editable={!!currentDocId}
              />
            </div>

            {/* 联想提示面板（编辑器下方，shrink-0 保证内容固定高度不被挤压） */}
            <div className="shrink-0">
              <HintPanel
                hints={hints}
                isVisible={isHintVisible}
                isLoading={isHintLoading}
                error={hintError}
              />
            </div>
          </div>
        </main>
      </div>

      {/* ===== 新建文档对话框 ===== */}
      <CreateDocDialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreate={handleCreateDocument}
      />

      {/* ===== 主题面板外部点击关闭遮罩（仅在面板打开时） ===== */}
      {/* z-45 介于侧边栏(z-40)和主题面板(z-50)之间，点击任意位置关闭面板 */}
      {isThemePanelOpen && (
        <div
          className="fixed inset-0 z-[45]"
          onClick={() => setIsThemePanelOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default EditorPage;
