/**
 * 手机号工具函数
 *
 * 用途：提供中国大陆手机号码的格式验证功能。
 *
 * 中国大陆手机号规则：
 * - 固定 11 位数字
 * - 第 1 位固定为 1
 * - 第 2 位为 3-9（目前运营商号段范围）
 * - 第 3-11 位为任意数字
 *
 * 示例：13812345678（有效）、12345678901（无效，第二位不在3-9范围）
 */

/**
 * 验证手机号格式是否符合中国大陆手机号规则
 *
 * @param phone - 待验证的手机号字符串
 * @returns true 表示格式有效，false 表示格式无效
 *
 * @example
 * ```typescript
 * isValidPhone('13812345678'); // true
 * isValidPhone('12345678901'); // false（第二位不在3-9范围）
 * isValidPhone('1381234567');  // false（不足11位）
 * isValidPhone('abc');         // false（包含非数字字符）
 * ```
 */
export function isValidPhone(phone: string): boolean {
  // 正则解释：
  // ^1       - 必须以 1 开头
  // [3-9]    - 第二位必须是 3 到 9 之间的数字
  // \d{9}$   - 后面跟 9 位任意数字，总共 11 位
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}
