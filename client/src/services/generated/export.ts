/**
 * 导出模块 - API 调用
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

import { apiClient } from '../api-client';
import type { ExportDto, ExportDocumentResponse } from './export.types';

export const exportApi = {
  /**
   * 导出文档
   * 将指定文档导出为 Word (.docx) 或 PDF (.pdf) 格式，返回二进制文件流
   */
  exportDocument(id: string, data: ExportDto) {
    return apiClient.post<ExportDocumentResponse>(`/export/${id}`, data);
  },

};
