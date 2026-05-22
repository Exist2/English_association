/**
 * 文档模块 - 类型定义
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

/** CreateDocumentDto */
export interface CreateDocumentDto {
  /** 文档标题 */
  title: string;
  /** 文档内容（富文本 JSON） */
  content: string;
}

/** UpdateDocumentDto */
export interface UpdateDocumentDto {
  /** 文档标题 */
  title?: string;
  /** 文档内容（富文本 JSON） */
  content?: string;
}

/** 创建文档 - 响应 */
export interface CreateResponse {
  id?: string;
  title?: string;
  createdAt?: string;
}

/** 查询文档列表 - 响应 */
export interface FindAllResponse {
  items?: {
  id?: string;
  title?: string;
  updatedAt?: string;
}[];
  total?: number;
  page?: number;
  pageSize?: number;
}

/** 获取文档详情 - 响应 */
export interface FindOneResponse {
  id?: string;
  title?: string;
  content?: string;
  updatedAt?: string;
}

/** 更新文档 - 响应 */
export interface UpdateResponse {
  id?: string;
  updatedAt?: string;
}

/** 删除文档 - 响应 */
export interface DeleteResponse {
  success?: boolean;
}
