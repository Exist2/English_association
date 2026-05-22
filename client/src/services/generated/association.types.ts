/**
 * 联想模块 - 类型定义
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

/** AssociationDto */
export interface AssociationDto {
  /** 用户输入的文本内容 */
  text: string;
  /** 语言类型（可选），前端传入的语言偏好，后端使用自动检测 */
  language?: 'zh' | 'en';
}

/** 获取联想/翻译结果 - 响应 */
export interface GetAssociationResponse {
  /** 联想结果数组，最多5条 */
  results?: {
  id?: string;
  text?: string;
  type?: 'translation' | 'association';
  confidence?: number;
}[];
  /** 检测到的语言类型 */
  detectedLanguage?: 'zh' | 'en' | 'unknown';
}
