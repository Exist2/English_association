/**
 * 设置模块 - 类型定义
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

/** UpdateThemeDto */
export interface UpdateThemeDto {
  /** 主题模式：light（明亮）或 dark（暗黑） */
  mode?: 'light' | 'dark';
  /** 编辑器字号大小，范围 12-24 */
  fontSize?: number;
  /** 联想提示显示时长，范围 3-30 秒 */
  hintDuration?: number;
}

/** 获取主题配置 - 响应 */
export interface GetThemeResponse {
  /** 主题模式 */
  mode?: 'light' | 'dark';
  /** 字号大小（12-24） */
  fontSize?: number;
  /** 提示显示时长（3-30秒） */
  hintDuration?: number;
}

/** 更新主题配置 - 响应 */
export interface UpdateThemeResponse {
  success?: boolean;
  config?: {
  mode?: 'light' | 'dark';
  fontSize?: number;
  hintDuration?: number;
};
}
