/**
 * 认证服务（AuthService）
 *
 * 用途：处理用户注册、登录、验证码发送与校验等核心认证逻辑。
 *
 * 存储方案：
 * - 用户信息：MySQL（通过 TypeORM Repository）
 * - 短信验证码：Redis（Key: sms:code:{phone_hash}，TTL: 60秒）
 * - 发送频率限制：Redis（Key: sms:limit:{phone_hash}，TTL: 60秒）
 * - 登录尝试记录：Redis（Key: login:attempt:{phone_hash}，TTL: 900秒/15分钟）
 *
 * 安全设计：
 * - 手机号在数据库中加密存储（AES），哈希值用于查询（SHA-256）
 * - 连续5次验证码错误锁定账户15分钟
 * - JWT 令牌有效期7天
 */
import { Injectable, Inject, BadRequestException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { User } from './entities';
import { REDIS_CLIENT } from '../../common/redis';
import { isValidPhone, encryptPhone, hashPhone } from '../../common/utils';

/**
 * JWT 载荷接口
 * @description JWT 令牌中存储的用户信息
 */
export interface UserPayload {
  /** 用户 UUID */
  sub: string;
  /** 手机号哈希（用于标识用户，不暴露真实手机号） */
  phoneHash: string;
}

/** 登录尝试记录的 Redis 存储结构 */
interface LoginAttemptData {
  failedCount: number;
}

/** 账户锁定相关常量 */
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_SECONDS = 900; // 15 分钟

/** 短信验证码相关常量 */
const SMS_CODE_TTL_SECONDS = 60; // 验证码有效期 60 秒
const SMS_RATE_LIMIT_TTL_SECONDS = 60; // 发送频率限制 60 秒

/** Redis Key 前缀 */
const REDIS_KEY_SMS_CODE = 'sms:code:';
const REDIS_KEY_SMS_LIMIT = 'sms:limit:';
const REDIS_KEY_LOGIN_ATTEMPT = 'login:attempt:';

@Injectable()
export class AuthService {
  constructor(
    /** TypeORM 用户仓库，用于数据库 CRUD 操作 */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    /** Redis 客户端，用于存储验证码和登录尝试记录 */
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,

    /** JWT 服务，用于签发和验证令牌 */
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 用户注册
   *
   * 流程：
   * 1. 验证手机号格式
   * 2. 检查手机号是否已注册（通过哈希值查询）
   * 3. 加密手机号并存储到数据库
   *
   * @param phone - 用户手机号（明文）
   * @throws BadRequestException 手机号格式无效
   * @throws ConflictException 手机号已注册
   */
  async register(phone: string): Promise<void> {
    // 步骤1：验证手机号格式
    if (!isValidPhone(phone)) {
      throw new BadRequestException('手机号格式无效，请输入11位中国大陆手机号');
    }

    // 步骤2：生成哈希值并检查是否已注册
    const phoneHashValue = hashPhone(phone);
    const existingUser = await this.userRepository.findOne({
      where: { phoneHash: phoneHashValue },
    });

    if (existingUser) {
      throw new ConflictException('该手机号已注册');
    }

    // 步骤3：加密手机号并创建用户记录
    const phoneEncryptedValue = encryptPhone(phone);
    const user = this.userRepository.create({
      phoneEncrypted: phoneEncryptedValue,
      phoneHash: phoneHashValue,
    });

    await this.userRepository.save(user);
  }

  /**
   * 滑块验证码校验
   *
   * 当前为 Mock 实现，始终返回 true。
   * 后续接入真实滑块验证码服务（如极验、网易易盾）时替换此逻辑。
   *
   * @param _phone - 用户手机号（当前未使用，预留参数）
   * @param _captchaToken - 滑块验证码 token（当前未使用）
   * @returns 验证是否通过
   */
  async verifyCaptcha(_phone: string, _captchaToken: string): Promise<boolean> {
    // TODO: 接入真实滑块验证码服务
    // 当前 Mock 实现：始终通过验证
    return true;
  }

  /**
   * 发送短信验证码
   *
   * 流程：
   * 1. 验证手机号格式
   * 2. 检查 60 秒内是否已发送过（频率限制）
   * 3. 生成 6 位随机验证码
   * 4. 将验证码存入 Redis（TTL 60秒）
   * 5. 设置频率限制标记（TTL 60秒）
   * 6. 发送短信（当前为 Mock，仅打印到控制台）
   *
   * @param phone - 用户手机号（明文）
   * @throws BadRequestException 手机号格式无效或发送过于频繁
   */
  async sendSmsCode(phone: string): Promise<void> {
    // 步骤1：验证手机号格式
    if (!isValidPhone(phone)) {
      throw new BadRequestException('手机号格式无效');
    }

    const phoneHashValue = hashPhone(phone);

    // 步骤2：检查频率限制（同一手机号 60 秒内只能发送 1 次）
    const rateLimitKey = `${REDIS_KEY_SMS_LIMIT}${phoneHashValue}`;
    const isLimited = await this.redis.get(rateLimitKey);
    if (isLimited) {
      throw new BadRequestException('验证码发送过于频繁，请60秒后重试');
    }

    // 步骤3：生成 6 位随机数字验证码
    // Math.random() 生成 0-1 之间的随机数，乘以 900000 再加 100000 确保结果在 100000-999999 之间
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 步骤4：将验证码存入 Redis，设置 60 秒过期
    const codeKey = `${REDIS_KEY_SMS_CODE}${phoneHashValue}`;
    await this.redis.set(codeKey, code, 'EX', SMS_CODE_TTL_SECONDS);

    // 步骤5：设置频率限制标记，60 秒内不允许再次发送
    await this.redis.set(rateLimitKey, '1', 'EX', SMS_RATE_LIMIT_TTL_SECONDS);

    // 步骤6：发送短信（Mock 实现，仅打印到控制台）
    // TODO: 接入真实短信服务（如阿里云短信、腾讯云短信）
    console.log(`[SMS Mock] 向手机号发送验证码: ${code}`);
  }

  /**
   * 用户登录
   *
   * 流程：
   * 1. 验证手机号格式
   * 2. 检查账户是否被锁定
   * 3. 从 Redis 获取验证码并校验
   * 4. 校验失败：增加失败计数，达到5次则锁定
   * 5. 校验成功：清除失败记录，查找/创建用户，签发 JWT
   *
   * @param phone - 用户手机号（明文）
   * @param code - 用户输入的验证码
   * @returns JWT 令牌和过期时间
   * @throws BadRequestException 手机号格式无效
   * @throws UnauthorizedException 账户锁定、验证码错误或过期
   */
  async login(
    phone: string,
    code: string,
  ): Promise<{ accessToken: string; expiresIn: number }> {
    // 步骤1：验证手机号格式
    if (!isValidPhone(phone)) {
      throw new BadRequestException('手机号格式无效');
    }

    const phoneHashValue = hashPhone(phone);

    // 步骤2：检查账户是否被锁定
    const lockStatus = await this.isAccountLocked(phone);
    if (lockStatus.locked) {
      throw new UnauthorizedException(
        `账户已锁定，请${lockStatus.remainingMinutes}分钟后重试`,
      );
    }

    // 步骤3：从 Redis 获取存储的验证码
    const codeKey = `${REDIS_KEY_SMS_CODE}${phoneHashValue}`;
    const storedCode = await this.redis.get(codeKey);

    // 步骤4：验证码校验
    if (!storedCode) {
      // 验证码不存在（已过期或未发送）
      await this.incrementFailedAttempts(phoneHashValue);
      throw new UnauthorizedException('验证码已过期，请重新获取');
    }

    if (storedCode !== code) {
      // 验证码不匹配
      await this.incrementFailedAttempts(phoneHashValue);
      throw new UnauthorizedException('验证码错误');
    }

    // 步骤5：验证码正确，清除相关记录
    // 删除已使用的验证码（防止重复使用）
    await this.redis.del(codeKey);
    // 清除登录失败记录
    const attemptKey = `${REDIS_KEY_LOGIN_ATTEMPT}${phoneHashValue}`;
    await this.redis.del(attemptKey);

    // 步骤6：查找用户（如果不存在则自动注册）
    let user = await this.userRepository.findOne({
      where: { phoneHash: phoneHashValue },
    });

    if (!user) {
      // 用户不存在，自动注册（登录即注册模式）
      const phoneEncryptedValue = encryptPhone(phone);
      user = this.userRepository.create({
        phoneEncrypted: phoneEncryptedValue,
        phoneHash: phoneHashValue,
      });
      user = await this.userRepository.save(user);
    }

    // 步骤7：签发 JWT 令牌
    const payload: UserPayload = {
      sub: user.id,
      phoneHash: user.phoneHash,
    };

    const accessToken = this.jwtService.sign(payload);

    // expiresIn 返回秒数：7天 = 7 * 24 * 60 * 60 = 604800 秒
    return {
      accessToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * 检查账户是否被锁定
   *
   * 锁定规则：连续5次验证码输入错误，账户锁定15分钟。
   * 锁定状态通过 Redis TTL 自动管理——当 key 过期时，锁定自动解除。
   *
   * @param phone - 用户手机号（明文）
   * @returns locked: 是否锁定；remainingMinutes: 剩余锁定分钟数
   */
  async isAccountLocked(
    phone: string,
  ): Promise<{ locked: boolean; remainingMinutes?: number }> {
    const phoneHashValue = hashPhone(phone);
    const attemptKey = `${REDIS_KEY_LOGIN_ATTEMPT}${phoneHashValue}`;

    // 从 Redis 获取登录尝试记录
    const attemptData = await this.redis.get(attemptKey);

    if (!attemptData) {
      // 没有记录，说明没有失败尝试或已过期（锁定已解除）
      return { locked: false };
    }

    const parsed: LoginAttemptData = JSON.parse(attemptData);

    if (parsed.failedCount >= MAX_FAILED_ATTEMPTS) {
      // 失败次数达到阈值，账户被锁定
      // 通过 Redis TTL 获取剩余锁定时间
      const ttl = await this.redis.ttl(attemptKey);
      const remainingMinutes = Math.ceil(ttl / 60);
      return { locked: true, remainingMinutes };
    }

    return { locked: false };
  }

  /**
   * 验证 JWT 令牌
   *
   * @param token - JWT 令牌字符串
   * @returns 解析后的用户载荷信息
   * @throws UnauthorizedException 令牌无效或已过期
   */
  async validateToken(token: string): Promise<UserPayload> {
    try {
      // jwtService.verify() 会验证签名和过期时间
      // 如果令牌无效或过期，会抛出异常
      const payload = this.jwtService.verify<UserPayload>(token);
      return payload;
    } catch {
      throw new UnauthorizedException('令牌无效或已过期');
    }
  }

  /**
   * 增加登录失败次数（私有方法）
   *
   * 每次验证码校验失败时调用：
   * - 如果是第一次失败，创建记录并设置 15 分钟 TTL
   * - 如果已有记录，failedCount +1 并保持原有 TTL
   *
   * @param phoneHashValue - 手机号哈希值
   */
  private async incrementFailedAttempts(phoneHashValue: string): Promise<void> {
    const attemptKey = `${REDIS_KEY_LOGIN_ATTEMPT}${phoneHashValue}`;
    const attemptData = await this.redis.get(attemptKey);

    let failedCount = 1;

    if (attemptData) {
      const parsed: LoginAttemptData = JSON.parse(attemptData);
      failedCount = parsed.failedCount + 1;
    }

    const newData: LoginAttemptData = { failedCount };

    // 获取当前 key 的剩余 TTL，如果是新 key 则使用默认锁定时长
    const currentTtl = await this.redis.ttl(attemptKey);
    const ttl = currentTtl > 0 ? currentTtl : LOCK_DURATION_SECONDS;

    await this.redis.set(attemptKey, JSON.stringify(newData), 'EX', ttl);
  }
}
