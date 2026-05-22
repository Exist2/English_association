/**
 * 联想模块 - API 调用
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

import { apiClient } from '../api-client';
import type { AssociationDto, GetAssociationResponse } from './association.types';

export const associationApi = {
  /**
   * 获取联想/翻译结果
   * 根据用户输入的文本自动检测语言类型，中文返回英文翻译，英文返回联想词汇。最多返回5条结果。
   */
  getAssociation(data: AssociationDto) {
    return apiClient.post<GetAssociationResponse>(`/association`, data);
  },

};
