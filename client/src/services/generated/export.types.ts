/**
 * 导出模块 - 类型定义
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

/** ExportDto */
export interface ExportDto {
  /** 导出格式 */
  format: 'docx' | 'pdf';
}

/** 导出文档 - 响应（二进制文件流） */
export type ExportDocumentResponse = Blob;
