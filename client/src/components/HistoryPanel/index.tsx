/**
 * HistoryPanel 组件 - 历史记录面板
 *
 * 功能：
 * 1. 左侧可折叠面板，展示用户的文档列表
 * 2. 文档按最后修改时间倒序排列
 * 3. 标题超过 20 字符截断并加省略号
 * 4. 显示相对修改时间（"刚刚"、"5分钟前"等）
 * 5. 支持滚动加载更多（每页 20 条）
 * 6. 支持标题模糊搜索（至少 1 字符触发）
 * 7. 点击文档加载到编辑器
 * 8. 删除文档前弹出确认对话框
 * 9. 搜索无结果时显示空状态提示
 * 10. 文档加载失败时显示错误提示
 *
 * 使用方式：
 * <HistoryPanel
 *   isCollapsed={isCollapsed}
 *   onToggleCollapse={handleToggle}
 *   onDocumentSelect={handleSelect}
 *   onDocumentDelete={handleDelete}
 *   currentDocId={currentDocId}
 * />
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDocument } from '../../hooks/useDocument';
import { useDebounce } from '../../hooks/useDebounce';

/**
 * HistoryPanel 组件 Props 接口
 */
export interface HistoryPanelProps {
  /** 面板是否折叠 */
  isCollapsed: boolean;
  /** 切换折叠状态的回调 */
  onToggleCollapse: () => void;
  /** 选中文档的回调，传入文档 ID */
  onDocumentSelect: (docId: string) => void;
  /** 删除文档的回调，传入文档 ID */
  onDocumentDelete: (docId: string) => void;
  /** 当前正在编辑的文档 ID（用于高亮显示） */
  currentDocId: string | null;
  /** 文档列表变为空时的回调（用于触发空状态引导页） */
  onListEmpty?: () => void;
  /** 外部更新的文档标题（id + 新标题），变化时同步到列表 */
  updatedDocTitle?: { id: string; title: string } | null;
  /** 外部新建的文档信号（变化时触发列表刷新） */
  refreshSignal?: number;
}

/**
 * 截断标题
 * 如果标题超过 20 个字符，截取前 20 个字符并加上省略号 "..."
 *
 * @param title - 原始标题
 * @returns 截断后的标题
 */
export function truncateTitle(title: string): string {
  if (title.length > 20) {
    return title.slice(0, 20) + '...';
  }
  return title;
}

/**
 * 格式化相对时间
 * 将 ISO 时间字符串转换为中文相对时间描述
 *
 * @param dateStr - ISO 格式的时间字符串（如 "2024-01-01T12:00:00Z"）
 * @returns 中文相对时间（如 "刚刚"、"5分钟前"、"2小时前"、"昨天"、"3天前"）
 */
export function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return '';

  const now = new Date();
  const date = new Date(dateStr);
  // 计算时间差（毫秒）
  const diffMs = now.getTime() - date.getTime();

  // 转换为各时间单位
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return '刚刚';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays === 1) {
    return '昨天';
  } else if (diffDays < 30) {
    return `${diffDays}天前`;
  } else {
    // 超过 30 天显示具体日期
    return date.toLocaleDateString('zh-CN');
  }
}

/**
 * HistoryPanel - 历史记录面板组件
 *
 * 左侧可折叠面板，展示用户文档列表，支持搜索、分页加载、删除等操作。
 * 面板宽度 260px（展开时），折叠时宽度为 0，使用 CSS transition 实现滑动动画。
 *
 * @param props - 组件属性
 */
export function HistoryPanel({
  isCollapsed,
  onToggleCollapse,
  onDocumentSelect,
  onDocumentDelete,
  currentDocId,
  onListEmpty,
  updatedDocTitle,
  refreshSignal,
}: HistoryPanelProps) {
  /** 搜索输入框的值 */
  const [searchInput, setSearchInput] = useState('');
  /** 要删除的文档信息（用于确认对话框） */
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  /** 是否正在执行删除操作 */
  const [isDeleting, setIsDeleting] = useState(false);
  /** 删除对话框是否可见（用于过渡动画） */
  const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState(false);
  /** 删除成功 Toast 消息 */
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState('');

  /**
   * 使用 useDebounce 对搜索输入进行防抖处理
   * 用户停止输入 300ms 后才触发搜索，避免频繁请求
   */
  const debouncedSearch = useDebounce(searchInput, 300);

  /**
   * 使用 useDocument Hook 获取文档管理相关的状态和方法
   */
  const {
    documents,
    isLoading,
    hasMore,
    loadMore,
    search,
    deleteDocument,
    loadDocument,
    searchKeyword,
    loadError,
    clearLoadError,
    updateLocalTitle,
    refresh,
  } = useDocument();

  /**
   * 列表容器的 ref，用于监听滚动事件实现滚动加载
   */
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * 当防抖后的搜索值变化时，触发搜索
   * 空字符串时获取全部文档，非空时进行模糊搜索
   */
  useEffect(() => {
    search(debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  /**
   * 当外部更新了文档标题时，同步到本地列表
   * 这样用户在顶部工具栏双击编辑标题后，左侧历史列表也能实时反映新标题
   */
  useEffect(() => {
    if (updatedDocTitle && updatedDocTitle.id && updatedDocTitle.title) {
      updateLocalTitle(updatedDocTitle.id, updatedDocTitle.title);
    }
  }, [updatedDocTitle, updateLocalTitle]);

  /**
   * 当 refreshSignal 变化时，刷新文档列表
   * 用于新建文档后同步列表显示
   */
  useEffect(() => {
    if (refreshSignal && refreshSignal > 0) {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  /**
   * 滚动事件处理
   * 当列表滚动到底部时，自动加载更多文档
   *
   * 原理：
   * scrollTop（已滚动距离）+ clientHeight（可见区域高度）≈ scrollHeight（总高度）
   * 当差值小于 50px 时认为已到底部
   */
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore || isLoading) return;

    const { scrollTop, clientHeight, scrollHeight } = el;
    // 距离底部不足 50px 时触发加载
    if (scrollHeight - scrollTop - clientHeight < 50) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  /**
   * 点击文档项，加载文档内容到编辑器
   */
  const handleDocumentClick = useCallback(
    async (docId: string) => {
      try {
        await loadDocument(docId);
        onDocumentSelect(docId);
      } catch {
        // loadDocument 内部已设置 loadError，这里不需要额外处理
      }
    },
    [loadDocument, onDocumentSelect],
  );

  /**
   * 点击删除按钮，打开确认对话框
   * 使用 stopPropagation 阻止事件冒泡到文档项的点击事件
   */
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent, docId: string, docTitle: string) => {
      e.stopPropagation();
      setDeleteTarget({ id: docId, title: docTitle });
      setIsDeleteDialogVisible(true);
    },
    [],
  );

  /**
   * 确认删除文档
   * 删除成功后自动选中下一篇文档：
   * - 如果有下一篇（列表中被删项的后一项），选中它
   * - 如果没有下一篇（被删的是最后一项），选中第一篇
   * - 如果删除后列表为空，触发空状态
   */
  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      // 删除前计算下一篇文档
      const deleteIndex = documents.findIndex((doc) => doc.id === deleteTarget.id);
      const remainingDocs = documents.filter((doc) => doc.id !== deleteTarget.id);

      await deleteDocument(deleteTarget.id);

      // 关闭对话框（带动画）
      setIsDeleteDialogVisible(false);
      setTimeout(() => setDeleteTarget(null), 200);

      // 显示删除成功 Toast
      setDeleteSuccessMsg('文档已删除');
      setTimeout(() => setDeleteSuccessMsg(''), 3000);

      // 删除后选中逻辑
      if (remainingDocs.length === 0) {
        // 列表为空，通知 EditorPage 清空并显示空白页
        onDocumentDelete(deleteTarget.id);
        if (onListEmpty) onListEmpty();
      } else {
        // 选中下一篇：优先选被删项后面的，没有则选第一篇
        const nextDoc = deleteIndex < remainingDocs.length
          ? remainingDocs[deleteIndex]
          : remainingDocs[0];
        // 先通知删除（清空当前文档状态）
        onDocumentDelete(deleteTarget.id);
        // 再选中下一篇
        onDocumentSelect(nextDoc.id);
      }
    } catch {
      // 删除失败，保持对话框打开让用户重试
      console.error('删除文档失败');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, deleteDocument, onDocumentDelete, onDocumentSelect, documents, onListEmpty]);

  /**
   * 取消删除
   */
  const handleCancelDelete = useCallback(() => {
    setIsDeleteDialogVisible(false);
    setTimeout(() => setDeleteTarget(null), 200);
  }, []);

  return (
    <>
      {/* ===== 侧边栏面板 ===== */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          w-[260px]
          bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]
          flex flex-col overflow-hidden
          lg:relative
          ${isCollapsed ? '-translate-x-full lg:ml-[-260px]' : 'translate-x-0 lg:ml-0'}
        `}
        style={{ transition: 'transform 200ms linear, margin-left 200ms linear' }}
        aria-label="历史记录面板"
      >
        {/* ----- 面板头部 ----- */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)] whitespace-nowrap">
            历史记录
          </h2>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-[var(--color-accent-light)] transition-colors duration-100"
            aria-label="折叠面板"
            title="折叠面板"
          >
            {/* 左箭头图标 - 表示折叠 */}
            <svg
              className="w-4 h-4 text-[var(--color-text-secondary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* ----- 搜索框 ----- */}
        <div className="px-4 py-3 shrink-0">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索文档标题..."
            className="
              w-full px-3 py-2 text-sm rounded-md border
              bg-[var(--color-bg-editor)] text-[var(--color-text-primary)]
              border-[var(--color-border)]
              placeholder:text-[var(--color-text-muted)]
              focus:border-[var(--color-border-focus)] focus:outline-none
              focus:ring-[3px] focus:ring-[var(--color-accent)]/10
              transition-all duration-200
            "
            aria-label="搜索文档"
          />
        </div>

        {/* ----- 文档列表 ----- */}
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-2"
        >
          {/* 加载中状态 */}
          {isLoading && documents.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-[var(--color-text-secondary)]">加载中...</span>
            </div>
          )}

          {/* 空状态：无文档 */}
          {!isLoading && documents.length === 0 && !searchKeyword && (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-[var(--color-text-muted)]">暂无文档</span>
            </div>
          )}

          {/* 搜索无结果状态 */}
          {!isLoading && documents.length === 0 && searchKeyword && (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-[var(--color-text-muted)]">未找到匹配的文档</span>
            </div>
          )}

          {/* 文档列表项 */}
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => handleDocumentClick(doc.id)}
              className={`
                group relative px-4 py-3 mx-1 my-0.5 rounded-md cursor-pointer
                transition-colors duration-100
                ${
                  currentDocId === doc.id
                    ? 'bg-[var(--color-accent-light)] border-l-[3px] border-l-[var(--color-accent)]'
                    : 'hover:bg-[var(--color-hint-bg)] border-l-[3px] border-l-transparent'
                }
              `}
              role="button"
              tabIndex={0}
              aria-label={`打开文档: ${doc.title}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDocumentClick(doc.id);
              }}
            >
              {/* 文档标题（CSS truncate 自动截断） */}
              <p className="text-sm text-[var(--color-text-primary)] truncate pr-6">
                {doc.title}
              </p>
              {/* 最后修改时间 */}
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {formatRelativeTime(doc.updatedAt)}
              </p>

              {/* 删除按钮（hover 时显示） */}
              <button
                onClick={(e) => handleDeleteClick(e, doc.id, doc.title)}
                className="
                  absolute top-1/2 right-2 -translate-y-1/2
                  p-1 rounded opacity-0 group-hover:opacity-100
                  hover:bg-[var(--color-error)]/20
                  transition-opacity duration-100
                "
                aria-label={`删除文档: ${doc.title}`}
                title="删除文档"
              >
                {/* 垃圾桶图标 */}
                <svg
                  className="w-3.5 h-3.5 text-[var(--color-error)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}

          {/* 加载更多指示器 */}
          {hasMore && documents.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <span className="text-xs text-[var(--color-text-muted)]">滚动加载更多...</span>
            </div>
          )}
        </div>
      </aside>

      {/* ===== 错误提示 Toast ===== */}
      {loadError && (
        <div
          className="
            fixed top-4 left-1/2 -translate-x-1/2 z-50
            px-4 py-2.5 rounded-lg
            bg-[var(--color-error)] text-white text-sm font-medium
            shadow-lg animate-[slideDown_300ms_ease-out]
          "
          role="alert"
        >
          <div className="flex items-center gap-2">
            <span>{loadError}</span>
            <button
              onClick={clearLoadError}
              className="ml-2 p-0.5 rounded hover:bg-white/20 transition-colors"
              aria-label="关闭错误提示"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ===== 删除确认对话框（始终渲染，通过 CSS 过渡控制显隐） ===== */}
      {deleteTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center ${isDeleteDialogVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
          onClick={handleCancelDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          {/* 遮罩层 */}
          <div
            className={`absolute inset-0 bg-black/40 ${isDeleteDialogVisible ? 'opacity-100' : 'opacity-0'}`}
            style={{ transition: 'opacity 200ms linear' }}
          />
          {/* 对话框内容 */}
          <div
            className={`
              relative w-full max-w-sm mx-4 p-6 rounded-xl bg-[var(--color-bg)] shadow-lg
              origin-center
              ${isDeleteDialogVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}
            `}
            style={{ transition: 'opacity 200ms linear, transform 200ms linear' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delete-confirm-title"
              className="text-base font-semibold text-[var(--color-text-primary)] mb-3"
            >
              确认删除
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              确定要删除文档 &ldquo;{truncateTitle(deleteTarget.title)}&rdquo; 吗？此操作不可恢复。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelDelete}
                className="
                  px-4 py-2 text-sm rounded-lg
                  text-[var(--color-text-secondary)]
                  hover:bg-[var(--color-bg-secondary)]
                  transition-colors
                "
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="
                  px-4 py-2 text-sm rounded-lg font-medium
                  bg-[var(--color-error)] text-white
                  hover:opacity-90
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-100
                "
              >
                {isDeleting ? '删除中...' : '确定删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 删除成功 Toast ===== */}
      {deleteSuccessMsg && (
        <div
          className="
            fixed top-4 left-0 right-0 z-50
            flex justify-center pointer-events-none
          "
          role="status"
        >
          <div
            className="
              px-4 py-2.5 rounded-lg
              bg-[var(--color-success)] text-white text-sm font-medium
              shadow-lg pointer-events-auto
            "
            style={{
              animation: 'toastIn 300ms linear forwards',
            }}
          >
            <div className="flex items-center gap-2">
              {/* 对勾图标 */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{deleteSuccessMsg}</span>
            </div>
          </div>
        </div>
      )}

      {/* ===== 折叠状态下的展开按钮 ===== */}
      {isCollapsed && (
        <button
          onClick={onToggleCollapse}
          className="
            fixed top-4 left-4 z-30
            p-2 rounded-lg
            bg-[var(--color-bg-secondary)] border border-[var(--color-border)]
            hover:bg-[var(--color-accent-light)]
            shadow-sm transition-colors duration-100
            lg:absolute
          "
          aria-label="展开历史记录面板"
          title="展开历史记录"
        >
          {/* 右箭头图标 + 文档图标 */}
          <svg
            className="w-5 h-5 text-[var(--color-text-secondary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </>
  );
}

export default HistoryPanel;
