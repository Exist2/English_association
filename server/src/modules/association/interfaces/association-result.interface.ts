/**
 * 联想结果接口定义
 *
 * 用途：定义联想引擎返回的单条结果的数据结构。
 * 无论是中文→英文翻译还是英文联想词汇，都使用这个统一的接口。
 */

/**
 * 联想结果项
 *
 * @property id - 结果唯一标识（UUID 格式）
 * @property text - 结果文本内容（翻译结果或联想词汇）
 * @property type - 结果类型：'translation' 表示翻译，'association' 表示联想
 * @property confidence - 可选的置信度分数（0-1之间，越高表示越相关）
 */
export interface AssociationResult {
  id: string;
  text: string;
  type: 'translation' | 'association';
  confidence?: number;
}
