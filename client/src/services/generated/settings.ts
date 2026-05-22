/**
 * 设置模块 - API 调用
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

import { apiClient } from '../api-client';
import type { UpdateThemeDto, GetThemeResponse, UpdateThemeResponse } from './settings.types';

export const settingsApi = {
  /**
   * 获取主题配置
   * 获取当前登录用户的主题配置，包括主题模式、字号大小和提示显示时长
   */
  getTheme() {
    return apiClient.get<GetThemeResponse>(`/settings/theme`);
  },

  /**
   * 更新主题配置
   * 更新当前登录用户的主题配置，支持部分更新（只传需要修改的字段）
   */
  updateTheme(data: UpdateThemeDto) {
    return apiClient.post<UpdateThemeResponse>(`/settings/theme/update`, data);
  },

};
