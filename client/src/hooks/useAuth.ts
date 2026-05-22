/**
 * 认证 Hook - useAuth
 *
 * 封装所有与用户认证相关的逻辑，包括：
 * 1. 登录状态检测（检查 localStorage 中是否有 JWT 令牌）
 * 2. 滑块验证码验证（调用后端 captcha/verify 接口）
 * 3. 发送短信验证码（调用后端 sms/send 接口）
 * 4. 登录操作（调用后端 login 接口，存储 JWT）
 * 5. 登出操作（清除 JWT，跳转登录页）
 *
 * 使用方式：
 * const { isLoggedIn, login, logout, sendSmsCode, verifyCaptcha } = useAuth();
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/generated';

/**
 * useAuth Hook 的返回值接口
 */
export interface UseAuthReturn {
  /** 用户是否已登录 */
  isLoggedIn: boolean;
  /** 登录操作（验证手机号+验证码） */
  login: (phone: string, code: string) => Promise<void>;
  /** 登出操作 */
  logout: () => void;
  /** 发送短信验证码 */
  sendSmsCode: (phone: string) => Promise<void>;
  /** 验证滑块验证码 */
  verifyCaptcha: (phone: string, token: string) => Promise<boolean>;
}

/**
 * useAuth - 认证自定义 Hook
 *
 * 提供登录、登出、发送验证码、验证滑块等功能。
 * 内部通过 apiClient 与后端通信，通过 localStorage 管理 JWT 令牌。
 *
 * @returns UseAuthReturn 对象，包含认证相关的状态和方法
 */
export function useAuth(): UseAuthReturn {
  /**
   * 登录状态：检查 localStorage 中是否存在 accessToken
   * useState 的初始值使用函数形式（惰性初始化），避免每次渲染都读取 localStorage
   */
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(
    () => !!localStorage.getItem('accessToken')
  );

  /**
   * useNavigate: React Router 提供的编程式导航 Hook
   * 用于在登录成功后跳转到编辑器页面
   */
  const navigate = useNavigate();

  /**
   * 验证滑块验证码
   *
   * 调用后端 POST /auth/captcha/verify 接口，
   * 验证用户是否通过了人机验证（滑块拖动到底）。
   *
   * @param phone - 用户输入的手机号
   * @param token - 滑块验证通过后生成的 token（MVP 阶段为简单字符串）
   * @returns true 表示验证通过，false 表示验证失败
   */
  const verifyCaptcha = useCallback(async (phone: string, token: string): Promise<boolean> => {
    const response = await authApi.captchaVerify({ phone, captchaToken: token });
    return !!response.data.success && !!response.data.canSendSms;
  }, []);

  /**
   * 发送短信验证码
   *
   * 调用后端 POST /auth/sms/send 接口，
   * 向用户手机发送 6 位数字验证码。
   * 同一手机号 60 秒内只能发送 1 次。
   *
   * @param phone - 用户输入的手机号
   * @throws 如果发送失败（如频率限制），会抛出错误
   */
  const sendSmsCode = useCallback(async (phone: string): Promise<void> => {
    await authApi.sendSms({ phone });
  }, []);

  /**
   * 登录操作
   *
   * 调用后端 POST /auth/login 接口，验证手机号和验证码。
   * 成功后：
   * 1. 将 JWT 令牌存储到 localStorage
   * 2. 更新登录状态
   * 3. 跳转到编辑器页面
   *
   * @param phone - 用户输入的手机号
   * @param code - 用户输入的 6 位短信验证码
   * @throws 如果登录失败（验证码错误、过期、账户锁定等），会抛出错误
   */
  const login = useCallback(async (phone: string, code: string): Promise<void> => {
    const response = await authApi.login({ phone, code });

    // 将 JWT 令牌存储到 localStorage，后续请求会通过拦截器自动附加
    localStorage.setItem('accessToken', response.data.accessToken!);

    // 更新组件内的登录状态
    setIsLoggedIn(true);

    // 跳转到编辑器页面
    navigate('/editor', { replace: true });
  }, [navigate]);

  /**
   * 登出操作
   *
   * 清除本地存储的 JWT 令牌，更新状态，跳转到登录页。
   */
  const logout = useCallback((): void => {
    localStorage.removeItem('accessToken');
    setIsLoggedIn(false);
    navigate('/login', { replace: true });
  }, [navigate]);

  return {
    isLoggedIn,
    login,
    logout,
    sendSmsCode,
    verifyCaptcha,
  };
}
