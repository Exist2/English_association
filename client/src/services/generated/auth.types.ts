/**
 * 认证模块 - 类型定义
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

/** RegisterDto */
export interface RegisterDto {
  /** 中国大陆11位手机号码 */
  phone: string;
}

/** CaptchaVerifyDto */
export interface CaptchaVerifyDto {
  /** 中国大陆11位手机号码 */
  phone: string;
  /** 滑块验证码 token（由前端滑块组件生成） */
  captchaToken: string;
}

/** SendSmsDto */
export interface SendSmsDto {
  /** 中国大陆11位手机号码 */
  phone: string;
}

/** LoginDto */
export interface LoginDto {
  /** 中国大陆11位手机号码 */
  phone: string;
  /** 6位数字短信验证码 */
  code: string;
}

/** 用户注册 - 响应 */
export interface RegisterResponse {
  success?: boolean;
  message?: string;
}

/** 滑块验证码校验 - 响应 */
export interface CaptchaVerifyResponse {
  success?: boolean;
  canSendSms?: boolean;
}

/** 发送短信验证码 - 响应 */
export interface SendSmsResponse {
  success?: boolean;
  message?: string;
}

/** 用户登录 - 响应 */
export interface LoginResponse {
  accessToken?: string;
  expiresIn?: number;
}
