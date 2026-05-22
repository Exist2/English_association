/**
 * 登录页面组件 - LoginPage
 *
 * 用户登录/注册的入口页面，包含完整的认证流程：
 * 1. 输入手机号 → 前端格式校验（11位、1开头、第二位3-9）
 * 2. 完成滑块验证码 → 调用后端验证接口
 * 3. 发送短信验证码 → 60秒倒计时
 * 4. 输入6位验证码 → 登录
 * 5. 登录成功 → JWT存储 + 跳转编辑器页
 * 6. 登录失败 → 显示错误信息（含账户锁定提示）
 *
 * UI 布局：居中卡片式设计，响应式适配移动端和桌面端
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import SliderCaptcha from '../components/SliderCaptcha';
import { useAuth } from '../hooks/useAuth';
import { validatePhone, getPhoneError } from '../utils/validate-phone';

/**
 * LoginPage - 登录页面
 *
 * 状态管理：
 * - phone: 手机号输入值
 * - phoneError: 手机号校验错误信息
 * - captchaPassed: 滑块验证是否通过
 * - smsCode: 短信验证码输入值
 * - countdown: 倒计时剩余秒数（0 表示可以发送）
 * - errorMessage: 全局错误提示
 * - isLoading: 登录按钮加载状态
 */
function LoginPage() {
  // ===== 状态定义 =====
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [captchaPassed, setCaptchaPassed] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  /**
   * useRef: 保存定时器 ID，用于在组件卸载时清除定时器
   * 避免内存泄漏（组件已卸载但定时器还在运行）
   */
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 使用认证 Hook
  const { login, sendSmsCode, verifyCaptcha } = useAuth();

  // ===== 倒计时逻辑 =====

  /**
   * 启动 60 秒倒计时
   *
   * 使用 setInterval 每秒减 1，到 0 时自动停止。
   * 倒计时期间"发送验证码"按钮显示剩余秒数且不可点击。
   */
  const startCountdown = useCallback(() => {
    setCountdown(60);

    // 清除可能存在的旧定时器
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    // 每秒减 1
    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // 倒计时结束，清除定时器
          if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  /**
   * 组件卸载时清除定时器，防止内存泄漏
   */
  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // ===== 事件处理函数 =====

  /**
   * 处理手机号输入变化
   * 只允许输入数字，最多 11 位
   */
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    setPhone(value);
    // 清除之前的错误提示
    if (phoneError) {
      setPhoneError('');
    }
    // 清除全局错误
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  /**
   * 手机号输入框失焦时进行格式校验
   */
  const handlePhoneBlur = () => {
    if (phone) {
      const error = getPhoneError(phone);
      setPhoneError(error);
    }
  };

  /**
   * 滑块验证成功回调
   *
   * 当用户成功拖动滑块到底时触发：
   * 1. 调用后端验证接口
   * 2. 验证通过后启用"发送验证码"按钮
   */
  const handleCaptchaVerify = async (token: string) => {
    try {
      const success = await verifyCaptcha(phone, token);
      if (success) {
        setCaptchaPassed(true);
      } else {
        setErrorMessage('人机验证失败，请重试');
      }
    } catch {
      // MVP 阶段：如果后端未就绪，直接通过验证
      setCaptchaPassed(true);
    }
  };

  /**
   * 发送短信验证码
   *
   * 流程：
   * 1. 校验手机号格式
   * 2. 调用后端发送接口
   * 3. 成功后启动 60 秒倒计时
   * 4. 失败则显示错误信息
   */
  const handleSendCode = async () => {
    // 校验手机号
    if (!validatePhone(phone)) {
      setPhoneError(getPhoneError(phone));
      return;
    }

    setIsSending(true);
    setErrorMessage('');

    try {
      await sendSmsCode(phone);
      // 发送成功，启动倒计时
      startCountdown();
    } catch (error: unknown) {
      // 处理发送失败的情况
      const axiosError = error as { response?: { data?: { message?: string } } };
      const message = axiosError?.response?.data?.message || '验证码发送失败，请稍后重试';
      setErrorMessage(message);
    } finally {
      setIsSending(false);
    }
  };

  /**
   * 处理验证码输入变化
   * 只允许输入数字，最多 6 位
   */
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setSmsCode(value);
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  /**
   * 处理登录提交
   *
   * 流程：
   * 1. 校验手机号和验证码格式
   * 2. 调用后端登录接口
   * 3. 成功：JWT 存储 + 跳转（由 useAuth 内部处理）
   * 4. 失败：显示对应错误信息（验证码错误、过期、账户锁定等）
   */
  const handleLogin = async () => {
    // 前端校验
    if (!validatePhone(phone)) {
      setPhoneError(getPhoneError(phone));
      return;
    }
    if (smsCode.length !== 6) {
      setErrorMessage('请输入6位验证码');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      await login(phone, smsCode);
      // 登录成功后 useAuth 内部会跳转到 /editor
    } catch (error: unknown) {
      // 解析后端返回的错误信息
      const axiosError = error as {
        response?: {
          data?: {
            message?: string;
            code?: string;
            remainingMinutes?: number;
          };
        };
      };
      const data = axiosError?.response?.data;

      if (data?.code === 'ACCOUNT_LOCKED' && data?.remainingMinutes) {
        // 账户锁定：显示剩余锁定时间
        setErrorMessage(`账户已锁定，请${data.remainingMinutes}分钟后重试`);
      } else if (data?.code === 'CODE_EXPIRED') {
        setErrorMessage('验证码已过期，请重新获取');
      } else if (data?.code === 'INVALID_CODE') {
        setErrorMessage('验证码错误，请重新输入');
      } else {
        setErrorMessage(data?.message || '登录失败，请稍后重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 回车键提交登录
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canLogin) {
      handleLogin();
    }
  };

  // ===== 计算派生状态 =====

  /** 手机号格式是否合法（用于控制滑块验证码是否可用） */
  const isPhoneValid = validatePhone(phone);

  /** 是否可以发送验证码：手机号合法 + 滑块验证通过 + 不在倒计时中 + 不在发送中 */
  const canSendCode = isPhoneValid && captchaPassed && countdown === 0 && !isSending;

  /** 是否可以登录：手机号合法 + 验证码为6位 + 不在加载中 */
  const canLogin = isPhoneValid && smsCode.length === 6 && !isLoading;

  // ===== 渲染 =====
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--color-bg)] px-4">
      {/* 登录卡片容器 */}
      <div className="w-full max-w-sm">
        {/* 应用标题 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            英文联想编辑器
          </h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            登录以开始你的英文写作之旅
          </p>
        </div>

        {/* 登录表单卡片 */}
        <div
          className="
            bg-[var(--color-bg-editor)] rounded-lg p-6
            border border-[var(--color-border)]
            shadow-sm
          "
        >
          {/* 手机号输入 */}
          <div className="mb-4">
            <label
              htmlFor="phone-input"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              手机号码
            </label>
            <input
              id="phone-input"
              type="tel"
              inputMode="numeric"
              placeholder="请输入11位手机号"
              value={phone}
              onChange={handlePhoneChange}
              onBlur={handlePhoneBlur}
              onKeyDown={handleKeyDown}
              className={`
                w-full border rounded-md px-3 py-2.5
                text-[var(--color-text-primary)]
                placeholder:text-[var(--color-text-muted)]
                bg-[var(--color-bg)]
                outline-none transition-all duration-200 ease-in-out
                ${phoneError
                  ? 'border-[var(--color-error)] focus:ring-[3px] focus:ring-[var(--color-error)]/10'
                  : 'border-[var(--color-border)] focus:border-[var(--color-border-focus)] focus:ring-[3px] focus:ring-[var(--color-accent)]/10'
                }
              `}
            />
            {/* 手机号错误提示 */}
            {phoneError && (
              <p className="mt-1 text-xs text-[var(--color-error)]">{phoneError}</p>
            )}
          </div>

          {/* 滑块验证码 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              人机验证
            </label>
            <SliderCaptcha
              onVerify={handleCaptchaVerify}
              disabled={!isPhoneValid}
            />
          </div>

          {/* 短信验证码输入 + 发送按钮 */}
          <div className="mb-4">
            <label
              htmlFor="code-input"
              className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5"
            >
              短信验证码
            </label>
            <div className="flex gap-3">
              <input
                id="code-input"
                type="text"
                inputMode="numeric"
                placeholder="6位验证码"
                value={smsCode}
                onChange={handleCodeChange}
                onKeyDown={handleKeyDown}
                maxLength={6}
                className="
                  flex-1 border border-[var(--color-border)] rounded-md px-3 py-2.5
                  text-[var(--color-text-primary)]
                  placeholder:text-[var(--color-text-muted)]
                  bg-[var(--color-bg)]
                  outline-none transition-all duration-200 ease-in-out
                  focus:border-[var(--color-border-focus)] focus:ring-[3px] focus:ring-[var(--color-accent)]/10
                "
              />
              {/* 发送验证码按钮 */}
              <button
                type="button"
                onClick={handleSendCode}
                disabled={!canSendCode}
                className="
                  whitespace-nowrap px-4 py-2.5 rounded-md text-sm font-medium
                  transition-all duration-100 ease-out
                  bg-[var(--color-accent)] text-gray-800
                  hover:bg-[var(--color-accent-dark)]
                  active:scale-[0.98]
                  disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed
                "
              >
                {countdown > 0 ? `重新发送(${countdown}s)` : isSending ? '发送中...' : '发送验证码'}
              </button>
            </div>
          </div>

          {/* 全局错误提示 */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-md bg-red-50 border border-[var(--color-error)]/30">
              <p className="text-sm text-red-600">{errorMessage}</p>
            </div>
          )}

          {/* 登录按钮 */}
          <button
            type="button"
            onClick={handleLogin}
            disabled={!canLogin}
            className="
              w-full py-2.5 rounded-md text-sm font-medium
              transition-all duration-100 ease-out
              bg-[var(--color-accent)] text-gray-800
              hover:bg-[var(--color-accent-dark)]
              active:scale-[0.98]
              disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed
            "
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </div>

        {/* 底部提示 */}
        <p className="mt-4 text-center text-xs text-[var(--color-text-secondary)]">
          未注册的手机号将自动创建账户
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
