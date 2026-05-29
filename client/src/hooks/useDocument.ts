/**
 * useDocument Hook - 文档管理逻辑
 *
 * 功能：
 * 1. 获取文档列表（分页加载，每页 20 条）
 * 2. 按标题模糊搜索文档（至少 1 个字符触发）
 * 3. 加载单个文档详情
 * 4. 删除文档
 * 5. 滚动加载更多文档
 *
 * 使用方式：
 * const { documents, isLoading, hasMore, loadMore, search, deleteDocument, loadDocument } = useDocument();
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { documentApi } from '../services/generated/document';

/**
 * 文档摘要信息接口
 * 用于文档列表中每一项的展示
 */
export interface DocumentSummary {
  /** 文档唯一标识 */
  id: string;
  /** 文档标题 */
  title: string;
  /** 最后修改时间（ISO 字符串） */
  updatedAt: string;
}

/**
 * useDocument Hook 返回值接口
 */
export interface UseDocumentReturn {
  /** 当前文档列表 */
  documents: DocumentSummary[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 是否还有更多数据可加载 */
  hasMore: boolean;
  /** 加载更多文档（下一页） */
  loadMore: () => Promise<void>;
  /** 按关键词搜索文档 */
  search: (keyword: string) => void;
  /** 删除指定文档 */
  deleteDocument: (docId: string) => Promise<void>;
  /** 加载指定文档的完整内容 */
  loadDocument: (docId: string) => Promise<{ title: string; content: string }>;
  /** 当前搜索关键词 */
  searchKeyword: string;
  /** 加载文档时的错误信息 */
  loadError: string | null;
  /** 清除加载错误 */
  clearLoadError: () => void;
  /** 更新本地列表中某个文档的标题（不发起网络请求） */
  updateLocalTitle: (docId: string, newTitle: string) => void;
}

/** 每页加载的文档数量 */
const PAGE_SIZE = 20;

/**
 * useDocument - 文档管理 Hook
 *
 * 封装文档列表的获取、搜索、分页加载、删除和详情加载逻辑。
 * 文档列表按 updatedAt 降序排列（由后端保证排序）。
 *
 * @returns UseDocumentReturn 文档管理相关的状态和方法
 *
 * @example
 * ```tsx
 * const { documents, isLoading, hasMore, loadMore, search } = useDocument();
 * ```
 */
export function useDocument(): UseDocumentReturn {
  /** 文档列表 */
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  /** 是否正在加载（首次加载或搜索时），初始为 true 因为挂载时会立即发起请求 */
  const [isLoading, setIsLoading] = useState(true);
  /** 是否还有更多数据 */
  const [hasMore, setHasMore] = useState(true);
  /** 当前页码（从 1 开始） */
  const [page, setPage] = useState(1);
  /** 当前搜索关键词 */
  const [searchKeyword, setSearchKeyword] = useState('');
  /** 加载文档详情时的错误信息 */
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * useRef 用于存储是否正在加载更多数据的标志
   * 防止滚动加载时重复触发请求
   *
   * useRef 的值在组件重新渲染时不会丢失，且修改它不会触发重新渲染
   */
  const isLoadingMore = useRef(false);

  /**
   * 获取文档列表
   *
   * @param pageNum - 页码
   * @param keyword - 搜索关键词（可选）
   * @param append - 是否追加到现有列表（用于滚动加载）
   */
  const fetchDocuments = useCallback(
    async (pageNum: number, keyword: string, append: boolean) => {
      try {
        if (!append) {
          setIsLoading(true);
        }

        // 构建请求参数
        const params: { page: number; pageSize: number; search?: string } = {
          page: pageNum,
          pageSize: PAGE_SIZE,
        };

        // 如果有搜索关键词，添加到请求参数中
        if (keyword.trim()) {
          params.search = keyword.trim();
        }

        const response = await documentApi.findAll(params);
        const data = response.data;

        // 将 API 返回的数据转换为 DocumentSummary 格式
        const items: DocumentSummary[] = (data.items || []).map((item) => ({
          id: item.id || '',
          title: item.title || '',
          updatedAt: item.updatedAt || '',
        }));

        if (append) {
          // 滚动加载：追加到现有列表
          setDocuments((prev) => [...prev, ...items]);
        } else {
          // 首次加载或搜索：替换列表
          setDocuments(items);
        }

        // 判断是否还有更多数据
        const total = data.total || 0;
        const currentTotal = append ? documents.length + items.length : items.length;
        setHasMore(currentTotal < total);
      } catch {
        // 列表加载失败时不阻塞用户操作，仅在控制台记录
        console.error('获取文档列表失败');
      } finally {
        setIsLoading(false);
        isLoadingMore.current = false;
      }
    },
    [documents.length],
  );

  /**
   * 组件挂载时加载第一页文档
   */
  useEffect(() => {
    fetchDocuments(1, '', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 搜索文档
   * 重置页码为 1，用新关键词重新获取列表
   *
   * @param keyword - 搜索关键词（至少 1 个字符触发搜索）
   */
  const search = useCallback(
    (keyword: string) => {
      setSearchKeyword(keyword);
      setPage(1);
      setHasMore(true);
      fetchDocuments(1, keyword, false);
    },
    [fetchDocuments],
  );

  /**
   * 加载更多文档（下一页）
   * 用于滚动到底部时触发
   */
  const loadMore = useCallback(async () => {
    // 防止重复加载
    if (isLoadingMore.current || !hasMore) return;

    isLoadingMore.current = true;
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchDocuments(nextPage, searchKeyword, true);
  }, [page, hasMore, searchKeyword, fetchDocuments]);

  /**
   * 删除文档
   * 调用 API 删除后，从本地列表中移除该文档
   *
   * @param docId - 要删除的文档 ID
   */
  const deleteDocument = useCallback(async (docId: string) => {
    await documentApi.delete(docId);
    // 从本地列表中移除已删除的文档
    setDocuments((prev) => prev.filter((doc) => doc.id !== docId));
  }, []);

  /**
   * 加载文档详情
   * 获取指定文档的完整内容（标题 + 富文本内容）
   *
   * @param docId - 文档 ID
   * @returns 包含 title 和 content 的对象
   * @throws 加载失败时抛出错误
   */
  const loadDocument = useCallback(async (docId: string): Promise<{ title: string; content: string }> => {
    try {
      setLoadError(null);
      const response = await documentApi.findOne(docId);
      const data = response.data;
      return {
        title: data.title || '',
        content: data.content || '',
      };
    } catch {
      const errorMsg = '文档加载失败';
      setLoadError(errorMsg);
      throw new Error(errorMsg);
    }
  }, []);

  /**
   * 清除加载错误
   */
  const clearLoadError = useCallback(() => {
    setLoadError(null);
  }, []);

  /**
   * 更新本地列表中某个文档的标题
   * 用于外部修改标题后同步到列表显示，不发起网络请求
   *
   * @param docId - 文档 ID
   * @param newTitle - 新标题
   */
  const updateLocalTitle = useCallback((docId: string, newTitle: string) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, title: newTitle } : doc))
    );
  }, []);

  return {
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
  };
}
