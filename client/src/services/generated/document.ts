/**
 * 文档模块 - API 调用
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

import { apiClient } from '../api-client';
import type { CreateDocumentDto, UpdateDocumentDto, CreateResponse, FindAllResponse, FindOneResponse, UpdateResponse, DeleteResponse } from './document.types';

export const documentApi = {
  /**
   * 创建文档
   * 创建一个新的文档
   */
  create(data: CreateDocumentDto) {
    return apiClient.post<CreateResponse>(`/documents`, data);
  },

  /**
   * 查询文档列表
   * 分页查询当前用户的文档列表，支持标题搜索
   */
  findAll(params?: { page?: number; pageSize?: number; search?: string }) {
    return apiClient.get<FindAllResponse>(`/documents`, { params });
  },

  /**
   * 获取文档详情
   * 获取指定文档的完整内容
   */
  findOne(id: string) {
    return apiClient.get<FindOneResponse>(`/documents/${id}`);
  },

  /**
   * 更新文档
   * 更新指定文档的标题和/或内容
   */
  update(id: string, data: UpdateDocumentDto) {
    return apiClient.post<UpdateResponse>(`/documents/${id}/update`, data);
  },

  /**
   * 删除文档
   * 永久删除指定文档
   */
  delete(id: string) {
    return apiClient.post<DeleteResponse>(`/documents/${id}/delete`);
  },

};
