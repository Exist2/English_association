/**
 * ExportButton 组件 - 文档导出按钮
 *
 * 提供文档导出功能，支持导出为 Word (.docx) 和 PDF (.pdf) 格式。
 * 核心交互流程：
 * 1. 用户点击按钮 → 展开格式选择下拉菜单
 * 2. 用户选择格式 → 发起导出请求（显示加载动画）
 * 3. 导出成功 → 自动触发浏览器下载
 * 4. 导出失败/超时 → 显示错误提示 + 重试按钮
 *
 * 特殊状态：
 * - 文档为空或未加载时，按钮禁用并显示提示
 * - 导出超时时间为 30 秒（使用 AbortController 中断请求）
 *
 * 使用方式：
 * <ExportButton documentId={currentDocId} isContentEmpty={!hasContent} />
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { apiClient } from "../../services/api-client";

// ==================== 类型定义 ====================

/**
 * ExportButton 组件的 Props
 */
export interface ExportButtonProps {
  /** 当前文档 ID，为 null 表示没有加载文档 */
  documentId: string | null;
  /** 文档内容是否为空 */
  isContentEmpty: boolean;
  /** 当前文档标题，用于导出文件命名 */
  documentTitle?: string;
}

/** 导出格式类型 */
type ExportFormat = "docx" | "pdf";

/** 导出状态类型 */
type ExportStatus = "idle" | "exporting" | "success" | "error" | "timeout";

// ==================== 常量定义 ====================

/** 导出超时时间（毫秒）：30 秒 */
const EXPORT_TIMEOUT_MS = 30000;

// ==================== 组件实现 ====================

/**
 * ExportButton - 文档导出按钮组件
 *
 * 包含一个主按钮和一个下拉菜单，用户可以选择导出为 Word 或 PDF 格式。
 * 导出过程中显示旋转加载动画，成功后自动触发浏览器下载。
 *
 * @param props - 包含 documentId 和 isContentEmpty
 * @returns JSX 元素
 */
export function ExportButton({
  documentId,
  isContentEmpty,
  documentTitle,
}: ExportButtonProps) {
  // ==================== 状态管理 ====================

  /** 下拉菜单是否展开 */
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  /** 当前导出状态 */
  const [exportStatus, setExportStatus] = useState<ExportStatus>("idle");

  /** 错误信息（导出失败时显示） */
  const [errorMessage, setErrorMessage] = useState("");

  /** 记录上次选择的格式，用于重试 */
  const [lastFormat, setLastFormat] = useState<ExportFormat>("docx");

  /**
   * AbortController 引用
   * AbortController 是浏览器原生 API，用于中断正在进行的网络请求。
   * 当导出超时时，调用 controller.abort() 可以立即取消请求。
   * 使用 useRef 保存引用，这样在组件重新渲染时不会丢失。
   */
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 下拉菜单容器的 DOM 引用
   * 用于检测点击是否发生在下拉菜单外部，从而关闭菜单。
   */
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ==================== 副作用 ====================

  /**
   * 点击外部关闭下拉菜单
   * 监听全局 mousedown 事件，如果点击位置不在下拉菜单内部，则关闭菜单。
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    // 只在菜单打开时监听
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    // 清理函数：组件卸载或菜单关闭时移除监听
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  /**
   * 组件卸载时中断正在进行的导出请求
   * 防止组件已卸载但请求回调仍尝试更新状态（导致内存泄漏警告）
   */
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // ==================== 核心逻辑 ====================

  /**
   * 判断按钮是否应该被禁用
   * 当没有文档 ID 或文档内容为空时，禁用导出按钮
   */
  const isDisabled = !documentId || isContentEmpty;

  /**
   * 判断是否正在导出中
   */
  const isExporting = exportStatus === "exporting";

  /**
   * 从响应头中提取文件名
   * 服务端通过 Content-Disposition 头返回文件名，格式如：
   * Content-Disposition: attachment; filename="文档.docx"
   *
   * @param contentDisposition - Content-Disposition 响应头的值
   * @param format - 导出格式，用于生成默认文件名
   * @returns 文件名字符串
   */
  function extractFilename(
    contentDisposition: string | null,
    format: ExportFormat,
  ): string {
    // 优先使用文档标题作为文件名
    if (documentTitle && documentTitle.trim()) {
      return `${documentTitle.trim()}.${format}`;
    }

    // 默认文件名
    const defaultName = `文档.${format}`;

    if (!contentDisposition) return defaultName;

    // 尝试匹配 filename="xxx" 或 filename=xxx 格式
    const filenameMatch = contentDisposition.match(
      /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
    );
    if (filenameMatch && filenameMatch[1]) {
      // 去除引号
      return filenameMatch[1].replace(/['"]/g, "");
    }

    return defaultName;
  }

  /**
   * 触发浏览器下载文件
   * 原理：创建一个临时的 <a> 标签，设置 href 为 Blob URL，
   * 设置 download 属性为文件名，然后模拟点击触发下载。
   *
   * Blob URL 是浏览器为内存中的二进制数据生成的临时 URL，
   * 下载完成后需要调用 URL.revokeObjectURL 释放内存。
   *
   * @param blob - 文件的二进制数据（Blob 对象）
   * @param filename - 下载时的文件名
   */
  function triggerDownload(blob: Blob, filename: string): void {
    // 创建 Blob URL（临时的内存地址）
    const url = URL.createObjectURL(blob);

    // 创建临时 <a> 标签
    const link = document.createElement("a");
    link.href = url;
    link.download = filename; // download 属性指定下载文件名

    // 将 <a> 标签添加到页面（某些浏览器要求元素在 DOM 中才能触发点击）
    document.body.appendChild(link);

    // 模拟点击触发下载
    link.click();

    // 清理：移除临时元素并释放 Blob URL 内存
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 执行导出操作
   * 这是核心导出逻辑，包含：
   * 1. 创建 AbortController 用于超时中断
   * 2. 设置 30 秒超时定时器
   * 3. 发送 POST 请求获取文件二进制数据
   * 4. 成功时触发浏览器下载
   * 5. 失败/超时时显示错误信息
   *
   * @param format - 导出格式（'docx' 或 'pdf'）
   */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      // 安全检查：没有文档 ID 时不执行
      if (!documentId) return;

      // 记录格式（用于重试）
      setLastFormat(format);

      // 关闭下拉菜单
      setIsDropdownOpen(false);

      // 设置导出中状态
      setExportStatus("exporting");
      setErrorMessage("");

      // 创建新的 AbortController 实例
      // AbortController 提供一个 signal 对象，传给 axios 后可以随时中断请求
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 设置 30 秒超时定时器
      // 如果 30 秒内请求未完成，自动中断请求并显示超时错误
      const timeoutId = setTimeout(() => {
        controller.abort();
        setExportStatus("timeout");
        setErrorMessage("导出超时，请重试");
      }, EXPORT_TIMEOUT_MS);

      try {
        // 发送导出请求
        // responseType: 'blob' 告诉 axios 将响应数据解析为二进制 Blob 对象
        // signal: controller.signal 允许我们在超时时中断请求
        const response = await apiClient.post(
          `/export/${documentId}`,
          { format },
          {
            responseType: "blob",
            signal: controller.signal,
            timeout: EXPORT_TIMEOUT_MS, // axios 自身的超时设置（双重保障）
          },
        );

        // 清除超时定时器（请求已成功完成，不需要再触发超时）
        clearTimeout(timeoutId);

        // 从响应头提取文件名
        const contentDisposition =
          response.headers["content-disposition"] || null;
        const filename = extractFilename(contentDisposition, format);

        // 触发浏览器下载
        triggerDownload(response.data as Blob, filename);

        // 更新状态为成功
        setExportStatus("success");

        // 3 秒后恢复为空闲状态
        setTimeout(() => {
          setExportStatus("idle");
        }, 3000);
      } catch (error: unknown) {
        // 清除超时定时器
        clearTimeout(timeoutId);

        // 如果是被 AbortController 中断的请求（超时导致），
        // 状态已经在 setTimeout 回调中设置了，这里不需要重复处理
        if (error instanceof Error && error.name === "AbortError") {
          // 超时中断 - 状态已在 timeout 回调中设置
          return;
        }

        // 检查 axios 的 CanceledError（axios 对 abort 的封装）
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "ERR_CANCELED"
        ) {
          // 请求被取消（超时） - 状态已设置
          return;
        }

        // 其他错误：网络错误、服务器错误等
        setExportStatus("error");
        setErrorMessage("导出失败，请重试");
      }
    },
    [documentId],
  );

  /**
   * 重试导出
   * 使用上次选择的格式重新发起导出请求
   */
  const handleRetry = useCallback(() => {
    handleExport(lastFormat);
  }, [handleExport, lastFormat]);

  /**
   * 关闭错误提示，恢复空闲状态
   */
  const handleDismissError = useCallback(() => {
    setExportStatus("idle");
    setErrorMessage("");
  }, []);

  // ==================== 渲染 ====================

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ===== 主按钮 =====
       * 样式与 ThemePanel 中"主题模式"按钮保持一致：
       * 默认 accent-light 浅色背景 + 主文字色，hover 切到 accent 强调色 + 深色文字
       * 过渡 200ms ease-in-out
       * 保留导出中（cursor-wait + 浅色）和禁用（灰色 + cursor-not-allowed）两种状态
       */}
      <button
        onClick={() => !isExporting && setIsDropdownOpen(!isDropdownOpen)}
        disabled={isDisabled || isExporting}
        title={isDisabled ? "文档无内容可导出" : "导出文档"}
        className={`
          flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium
          transition-all duration-200 ease-in-out
          ${
            isDisabled
              ? "bg-gray-100 text-gray-300 cursor-not-allowed dark:bg-[#2D2E42] dark:text-[#6B7280]"
              : isExporting
                ? "bg-[var(--color-accent-light)] text-[var(--color-text-primary)] cursor-wait"
                : "bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] cursor-pointer"
          }
        `}
      >
        {isExporting ? (
          <>
            {/* 导出中：旋转加载图标 */}
            <svg
              className="w-4 h-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v4" />
              <path d="M12 18v4" />
              <path d="M4.93 4.93l2.83 2.83" />
              <path d="M16.24 16.24l2.83 2.83" />
              <path d="M2 12h4" />
              <path d="M18 12h4" />
              <path d="M4.93 19.07l2.83-2.83" />
              <path d="M16.24 7.76l2.83-2.83" />
            </svg>
            <span>导出中...</span>
          </>
        ) : (
          <>
            {/* 默认状态：导出图标 */}
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>导出</span>
          </>
        )}
      </button>

      {/* ===== 下拉菜单 ===== */}
      {isDropdownOpen && !isDisabled && (
        <div
          className="
          absolute right-0 top-full mt-1 z-50
          w-40 rounded-md py-1
          bg-[var(--color-bg)] border border-[var(--color-border)]
          shadow-md
          transition-all duration-200 ease-in-out
        "
        >
          {/* Word 格式选项 */}
          <button
            onClick={() => handleExport("docx")}
            className="
              w-full text-left px-3 py-2 text-sm
              text-[var(--color-text-primary)]
              hover:bg-[var(--color-accent-light)]
              transition-colors duration-100
            "
          >
            <div className="flex items-center gap-2">
              {/* Word 图标 */}
              <svg
                className="w-4 h-4 text-blue-500"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5zM7 13l1.5 5 1.5-3.5L11.5 18 13 13h1.5l-2.5 7h-1l-1.5-4-1.5 4h-1L5 13h2z" />
              </svg>
              <span>导出为 Word</span>
            </div>
          </button>

          {/* PDF 格式选项 */}
          <button
            onClick={() => handleExport("pdf")}
            className="
              w-full text-left px-3 py-2 text-sm
              text-[var(--color-text-primary)]
              hover:bg-[var(--color-accent-light)]
              transition-colors duration-100
            "
          >
            <div className="flex items-center gap-2">
              {/* PDF 图标 */}
              <svg
                className="w-4 h-4 text-red-500"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 2a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6H6zm7 1.5L18.5 9H13V3.5zM8 13c.6 0 1.1.2 1.4.5.3.3.5.8.5 1.3 0 .5-.2 1-.5 1.3-.3.3-.8.5-1.4.5H7v2H5.5v-5.6H8zm4.5 0c.8 0 1.4.2 1.9.7.5.5.7 1.1.7 1.9s-.2 1.4-.7 1.9c-.5.5-1.1.7-1.9.7H11v-5.2h1.5zm4 0v1.2h-1.3v1.2h1.1v1.1h-1.1V19h-1.5v-6h2.8zM7 14.2v1.4h.8c.2 0 .4-.1.5-.2.1-.1.2-.3.2-.5s-.1-.4-.2-.5c-.1-.1-.3-.2-.5-.2H7zm4.5.1v3h.3c.4 0 .7-.1.9-.4.2-.3.3-.6.3-1.1 0-.5-.1-.8-.3-1.1-.2-.3-.5-.4-.9-.4h-.3z" />
              </svg>
              <span>导出为 PDF</span>
            </div>
          </button>
        </div>
      )}

      {/* ===== 错误/超时提示 ===== */}
      {(exportStatus === "error" || exportStatus === "timeout") && (
        <div
          className="
            absolute right-0 top-full mt-1 z-50
            w-64 rounded-lg p-4
            bg-[var(--color-bg)] border border-[var(--color-border)]
            shadow-md space-y-4
          "
        >
          {/* 错误信息 */}
          <div className="flex items-start gap-3 text-left">
            {/* 错误图标 */}
            <svg
              className="w-4 h-4 mt-0.5 text-[var(--color-error)] shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="flex-1 text-sm leading-5 text-[var(--color-text-primary)]">
              {errorMessage}
            </p>
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center gap-2">
            {/* 重试按钮 */}
            <button
              onClick={handleRetry}
              className="
                flex-1 rounded-md px-3 py-2 text-sm font-medium
                bg-[var(--color-accent)] text-white
                hover:bg-[var(--color-accent-dark)]
                transition-all duration-100 ease-out
              "
            >
              重试
            </button>
            {/* 关闭按钮 */}
            <button
              onClick={handleDismissError}
              className="
                flex-1 rounded-md px-3 py-2 text-sm font-medium
                text-[var(--color-text-secondary)]
                hover:bg-[var(--color-bg-hover)]
                transition-all duration-100 ease-out
              "
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
