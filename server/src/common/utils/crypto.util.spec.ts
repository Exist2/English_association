/**
 * 加密工具函数单元测试
 *
 * 测试 AES 加密/解密和 SHA-256 哈希功能：
 * - 加密后的值不等于原始值
 * - 解密后能还原为原始值
 * - 相同输入的哈希值相同
 * - 不同输入的哈希值不同
 * - 哈希值固定为 64 个十六进制字符
 */
import { encryptPhone, decryptPhone, hashPhone } from './crypto.util';

// 在测试开始前设置环境变量，模拟 .env 中的 ENCRYPTION_KEY
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';
});

afterAll(() => {
  delete process.env.ENCRYPTION_KEY;
});

describe('encryptPhone / decryptPhone', () => {
  const testPhone = '13812345678';

  it('加密后的值应不等于原始手机号', () => {
    const encrypted = encryptPhone(testPhone);
    expect(encrypted).not.toBe(testPhone);
  });

  it('解密后应还原为原始手机号', () => {
    const encrypted = encryptPhone(testPhone);
    const decrypted = decryptPhone(encrypted);
    expect(decrypted).toBe(testPhone);
  });

  it('同一手机号每次加密结果应不同（因为随机 IV）', () => {
    const encrypted1 = encryptPhone(testPhone);
    const encrypted2 = encryptPhone(testPhone);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('不同手机号加密后都能正确解密', () => {
    const phones = ['13900001111', '15888889999', '19712345678'];
    for (const phone of phones) {
      const encrypted = encryptPhone(phone);
      const decrypted = decryptPhone(encrypted);
      expect(decrypted).toBe(phone);
    }
  });

  it('加密结果应为有效的 Base64 字符串', () => {
    const encrypted = encryptPhone(testPhone);
    // Base64 字符集：A-Z, a-z, 0-9, +, /, =
    expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('未设置 ENCRYPTION_KEY 时应抛出错误', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    expect(() => encryptPhone(testPhone)).toThrow('ENCRYPTION_KEY');

    process.env.ENCRYPTION_KEY = originalKey;
  });
});

describe('hashPhone', () => {
  const testPhone = '13812345678';

  it('哈希值应为 64 个十六进制字符', () => {
    const hash = hashPhone(testPhone);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('相同手机号的哈希值应相同', () => {
    const hash1 = hashPhone(testPhone);
    const hash2 = hashPhone(testPhone);
    expect(hash1).toBe(hash2);
  });

  it('不同手机号的哈希值应不同', () => {
    const hash1 = hashPhone('13812345678');
    const hash2 = hashPhone('13900001111');
    expect(hash1).not.toBe(hash2);
  });

  it('哈希值不应等于原始手机号', () => {
    const hash = hashPhone(testPhone);
    expect(hash).not.toBe(testPhone);
  });
});
