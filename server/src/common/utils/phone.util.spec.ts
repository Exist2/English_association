/**
 * 手机号验证函数单元测试
 *
 * 测试 isValidPhone 函数对各种输入的验证行为：
 * - 有效手机号应返回 true
 * - 无效手机号应返回 false
 */
import { isValidPhone } from './phone.util';

describe('isValidPhone', () => {
  describe('有效手机号', () => {
    it('应接受标准 11 位手机号（13x开头）', () => {
      expect(isValidPhone('13812345678')).toBe(true);
    });

    it('应接受 14x 开头的手机号', () => {
      expect(isValidPhone('14512345678')).toBe(true);
    });

    it('应接受 15x 开头的手机号', () => {
      expect(isValidPhone('15012345678')).toBe(true);
    });

    it('应接受 16x 开头的手机号', () => {
      expect(isValidPhone('16612345678')).toBe(true);
    });

    it('应接受 17x 开头的手机号', () => {
      expect(isValidPhone('17012345678')).toBe(true);
    });

    it('应接受 18x 开头的手机号', () => {
      expect(isValidPhone('18912345678')).toBe(true);
    });

    it('应接受 19x 开头的手机号', () => {
      expect(isValidPhone('19912345678')).toBe(true);
    });
  });

  describe('无效手机号', () => {
    it('应拒绝空字符串', () => {
      expect(isValidPhone('')).toBe(false);
    });

    it('应拒绝不足 11 位的数字', () => {
      expect(isValidPhone('1381234567')).toBe(false);
    });

    it('应拒绝超过 11 位的数字', () => {
      expect(isValidPhone('138123456789')).toBe(false);
    });

    it('应拒绝不以 1 开头的号码', () => {
      expect(isValidPhone('23812345678')).toBe(false);
    });

    it('应拒绝第二位为 0 的号码', () => {
      expect(isValidPhone('10812345678')).toBe(false);
    });

    it('应拒绝第二位为 1 的号码', () => {
      expect(isValidPhone('11812345678')).toBe(false);
    });

    it('应拒绝第二位为 2 的号码', () => {
      expect(isValidPhone('12812345678')).toBe(false);
    });

    it('应拒绝包含字母的字符串', () => {
      expect(isValidPhone('1381234567a')).toBe(false);
    });

    it('应拒绝包含特殊字符的字符串', () => {
      expect(isValidPhone('138-1234-567')).toBe(false);
    });

    it('应拒绝包含空格的字符串', () => {
      expect(isValidPhone('138 1234 567')).toBe(false);
    });

    it('应拒绝纯字母字符串', () => {
      expect(isValidPhone('abcdefghijk')).toBe(false);
    });

    it('应拒绝 SQL 注入字符串', () => {
      expect(isValidPhone("'; DROP TABLE --")).toBe(false);
    });
  });
});
