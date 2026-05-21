/**
 * 加密工具函数
 *
 * 用途：提供手机号的 AES 加密/解密和 SHA-256 哈希功能。
 *
 * ============================================================
 * 为什么需要两种方式（加密 + 哈希）？
 * ============================================================
 *
 * 1. AES 加密（可逆）：
 *    - AES 是一种对称加密算法，使用同一个密钥进行加密和解密
 *    - 加密后的数据可以通过密钥还原为原始数据
 *    - 用途：当我们需要查看用户的真实手机号时（如发送短信），可以解密还原
 *    - 本项目使用 AES-256-CBC 模式（256位密钥 + CBC链式分组模式）
 *
 * 2. SHA-256 哈希（不可逆）：
 *    - SHA-256 是一种单向哈希算法，无法从哈希值反推出原始数据
 *    - 相同的输入永远产生相同的输出（确定性）
 *    - 用途：用于数据库查询。因为 AES 加密每次使用随机 IV，同一手机号加密后的结果每次不同，
 *      无法直接用加密值做 WHERE 查询。而哈希值是固定的，可以用来快速查找用户。
 *
 * ============================================================
 * 什么是 IV（初始化向量）？为什么要随机？
 * ============================================================
 *
 * IV（Initialization Vector）是 CBC 模式加密时需要的一个随机值：
 * - 它确保相同的明文每次加密后产生不同的密文
 * - 如果不用随机 IV，攻击者可以通过比较密文来判断两个用户是否使用相同手机号
 * - IV 不需要保密，但必须每次不同，所以我们把它拼接在密文前面一起存储
 *
 * 存储格式：[16字节IV][加密后的数据] → 整体做 Base64 编码
 */

import * as crypto from 'crypto';

/**
 * AES 加密算法配置常量
 * AES-256-CBC 需要 32 字节（256位）的密钥和 16 字节（128位）的 IV
 */
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // CBC 模式的 IV 长度固定为 16 字节

/**
 * 获取加密密钥
 *
 * 从环境变量 ENCRYPTION_KEY 读取密钥。
 * AES-256 要求密钥必须是 32 字节，这里使用 SHA-256 对环境变量值做哈希，
 * 确保无论用户设置什么长度的密钥，最终都能得到固定 32 字节的密钥。
 *
 * @returns 32 字节的 Buffer 作为加密密钥
 * @throws 如果环境变量 ENCRYPTION_KEY 未设置则抛出错误
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY 环境变量未设置。请在 .env 文件中配置加密密钥。',
    );
  }
  // 使用 SHA-256 将任意长度的密钥字符串转换为固定 32 字节
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * 使用 AES-256-CBC 加密手机号
 *
 * 加密流程：
 * 1. 生成 16 字节的随机 IV
 * 2. 使用密钥和 IV 创建加密器
 * 3. 加密明文数据
 * 4. 将 IV 和密文拼接后做 Base64 编码
 *
 * @param phone - 要加密的手机号明文
 * @returns Base64 编码的加密结果（包含 IV + 密文）
 *
 * @example
 * ```typescript
 * const encrypted = encryptPhone('13812345678');
 * // 返回类似 "dGhpcyBpcyBhIHRlc3Q..." 的 Base64 字符串
 * // 每次调用结果不同（因为 IV 随机）
 * ```
 */
export function encryptPhone(phone: string): string {
  const key = getEncryptionKey();

  // crypto.randomBytes 生成密码学安全的随机字节，用作 IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // 创建加密器：指定算法、密钥、IV
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // 加密数据：update 处理输入，final 处理最后的填充块
  const encrypted = Buffer.concat([
    cipher.update(phone, 'utf8'),
    cipher.final(),
  ]);

  // 将 IV 和密文拼接，然后做 Base64 编码
  // 解密时需要先取出前 16 字节作为 IV，剩余部分为密文
  const result = Buffer.concat([iv, encrypted]);
  return result.toString('base64');
}

/**
 * 解密 AES-256-CBC 加密的手机号
 *
 * 解密流程：
 * 1. 对 Base64 字符串解码
 * 2. 取出前 16 字节作为 IV
 * 3. 剩余部分为密文
 * 4. 使用密钥和 IV 创建解密器
 * 5. 解密得到原始手机号
 *
 * @param encryptedPhone - Base64 编码的加密手机号
 * @returns 解密后的手机号明文
 *
 * @example
 * ```typescript
 * const encrypted = encryptPhone('13812345678');
 * const decrypted = decryptPhone(encrypted);
 * console.log(decrypted); // '13812345678'
 * ```
 */
export function decryptPhone(encryptedPhone: string): string {
  const key = getEncryptionKey();

  // 将 Base64 字符串解码为 Buffer
  const data = Buffer.from(encryptedPhone, 'base64');

  // 前 16 字节是 IV，剩余部分是密文
  const iv = data.subarray(0, IV_LENGTH);
  const encrypted = data.subarray(IV_LENGTH);

  // 创建解密器：使用相同的算法、密钥和 IV
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  // 解密数据
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * 使用 SHA-256 对手机号生成哈希值
 *
 * SHA-256 特点：
 * - 输出固定 64 个十六进制字符（256位）
 * - 相同输入永远产生相同输出
 * - 不可逆（无法从哈希值还原手机号）
 * - 用于数据库中快速查找用户（WHERE phone_hash = ?）
 *
 * @param phone - 要哈希的手机号
 * @returns 64 个十六进制字符的哈希字符串
 *
 * @example
 * ```typescript
 * const hash = hashPhone('13812345678');
 * // 返回固定 64 字符的十六进制字符串，如 "a1b2c3d4..."
 * // 相同手机号每次调用结果相同
 * ```
 */
export function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}
