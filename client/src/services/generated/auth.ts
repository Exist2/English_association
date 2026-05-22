/**
 * 认证模块 - API 调用
 *
 * ⚠️ 此文件由 generate-api.mjs 自动生成，请勿手动修改！
 */

import { apiClient } from '../api-client';
import type { RegisterDto, CaptchaVerifyDto, SendSmsDto, LoginDto, RegisterResponse, CaptchaVerifyResponse, SendSmsResponse, LoginResponse } from './auth.types';

export const authApi = {
  /**
   * 用户注册
   * 使用手机号注册新账户
   */
  register(data: RegisterDto) {
    return apiClient.post<RegisterResponse>(`/auth/register`, data);
  },

  /**
   * 滑块验证码校验
   * 校验滑块验证码 token，通过后允许发送短信验证码
   */
  captchaVerify(data: CaptchaVerifyDto) {
    return apiClient.post<CaptchaVerifyResponse>(`/auth/captcha/verify`, data);
  },

  /**
   * 发送短信验证码
   * 向指定手机号发送6位数字验证码，60秒内不可重复发送
   */
  sendSms(data: SendSmsDto) {
    return apiClient.post<SendSmsResponse>(`/auth/sms/send`, data);
  },

  /**
   * 用户登录
   * 使用手机号和短信验证码登录，返回 JWT 令牌
   */
  login(data: LoginDto) {
    return apiClient.post<LoginResponse>(`/auth/login`, data);
  },

};
