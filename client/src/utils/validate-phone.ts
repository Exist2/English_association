/**
 * 手机号码格式校验工具
 *
 * 校验规则（中国大陆手机号）：
 * - 必须为 11 位数字
 * - 第 1 位必须为 1
 * - 第 2 位必须为 3-9（目前运营商号段范围）
 * - 第 3-11 位为任意数字
 *
 * 正则表达式解释：
 * ^1       → 以数字 1 开头
 * [3-9]    → 第二位是 3 到 9 之间的数字
 * \d{9}$   → 后面跟 9 位任意数字，到字符串结尾
 */

/** 中国大陆手机号正则表达式 */
const PHONE_REGEX = /^1[3-9]\d{9}$/;

/**
 * 校验手机号码格式是否合法
 *
 * @param phone - 待校验的手机号字符串
 * @returns true 表示格式合法，false 表示格式不合法
 *
 * @example
 * validatePhone('13812345678') // true
 * validatePhone('12345678901') // false（第二位不能是2）
 * validatePhone('1381234567')  // false（不足11位）
 */
export function validatePhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

/**
 * 获取手机号格式校验的错误提示信息
 *
 * @param phone - 待校验的手机号字符串
 * @returns 错误提示信息，如果格式正确则返回空字符串
 */
export function getPhoneError(phone: string): string {
  if (!phone) {
    return '请输入手机号码';
  }
  if (!/^\d+$/.test(phone)) {
    return '手机号码只能包含数字';
  }
  if (phone.length !== 11) {
    return '手机号码必须为11位';
  }
  if (phone[0] !== '1') {
    return '手机号码必须以1开头';
  }
  if (!/[3-9]/.test(phone[1])) {
    return '手机号码第二位必须为3-9';
  }
  return '';
}
