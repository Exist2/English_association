/**
 * 主题配置接口定义
 *
 * 用途：定义用户主题配置的数据结构，用于前后端数据传输和类型校验。
 * 包含主题模式、字号大小、提示显示时长三个配置项。
 */

/**
 * 主题配置接口
 * @description 用户的个性化外观配置，包含主题模式、字号和提示时长
 */
export interface ThemeConfig {
  /** 主题模式：'light' 明亮主题 | 'dark' 暗黑主题 */
  mode: 'light' | 'dark';
  /** 编辑器字号大小，有效范围 12-24（单位 px） */
  fontSize: number;
  /** 联想提示显示时长，有效范围 3-30（单位秒） */
  hintDuration: number;
}
