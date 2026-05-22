/**
 * 滑块验证码组件 - SliderCaptcha
 *
 * 简化版人机验证组件（MVP 版本）。
 * 用户需要将滑块从左侧拖动到右侧末端，完成验证。
 *
 * 工作原理：
 * 1. 显示一个滑动轨道和一个可拖动的滑块按钮
 * 2. 用户按住滑块向右拖动
 * 3. 当滑块到达轨道末端（允许一定误差）时，触发验证成功
 * 4. 验证成功后显示绿色对勾，调用 onVerify 回调
 *
 * 注意：这是 MVP 简化版本，没有复杂的拼图验证逻辑，
 * 只需要拖动到底即可通过验证。
 */

import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * SliderCaptcha 组件的 Props 接口
 */
interface SliderCaptchaProps {
  /** 验证成功后的回调函数，参数为验证 token */
  onVerify: (token: string) => void;
  /** 是否禁用滑块（如手机号未填写时） */
  disabled?: boolean;
}

/** 滑块按钮的宽度（像素） */
const SLIDER_WIDTH = 44;
/** 验证成功的阈值：滑块到达轨道末端的误差范围（像素） */
const THRESHOLD = 10;

/**
 * SliderCaptcha - 滑块验证码组件
 *
 * @param props.onVerify - 验证成功回调，传入一个简单的 token 字符串
 * @param props.disabled - 是否禁用
 */
function SliderCaptcha({ onVerify, disabled = false }: SliderCaptchaProps) {
  /** 滑块当前位置（像素值，相对于轨道左侧） */
  const [sliderX, setSliderX] = useState(0);
  /** 是否正在拖动 */
  const [isDragging, setIsDragging] = useState(false);
  /** 是否已验证成功 */
  const [isVerified, setIsVerified] = useState(false);

  /**
   * useRef: 用于保存 DOM 元素的引用和可变值，不会触发重新渲染
   * trackRef: 获取轨道容器的宽度
   * startXRef: 记录拖动开始时的偏移量
   * sliderXRef: 保存最新的 sliderX 值（在事件回调中使用）
   */
  const trackRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const sliderXRef = useRef(0);

  // 同步 sliderX 到 ref，让事件回调能读到最新值
  useEffect(() => {
    sliderXRef.current = sliderX;
  }, [sliderX]);

  /**
   * 获取轨道的可滑动最大距离
   * = 轨道总宽度 - 滑块按钮宽度
   */
  const getMaxDistance = useCallback((): number => {
    if (!trackRef.current) return 0;
    return trackRef.current.offsetWidth - SLIDER_WIDTH;
  }, []);

  /**
   * 处理拖动过程中的移动
   * 计算新位置并限制在 [0, maxDistance] 范围内
   */
  const handleMove = useCallback((clientX: number) => {
    const maxDistance = getMaxDistance();
    // 计算新位置 = 当前鼠标位置 - 起始偏移量
    let newX = clientX - startXRef.current;
    // 限制范围：不能小于 0，不能超过最大距离
    newX = Math.max(0, Math.min(newX, maxDistance));
    setSliderX(newX);
  }, [getMaxDistance]);

  /**
   * 处理拖动结束
   * 判断滑块是否到达终点，如果到达则触发验证成功
   */
  const handleEnd = useCallback(() => {
    setIsDragging(false);

    const maxDistance = getMaxDistance();
    const currentX = sliderXRef.current;

    if (currentX >= maxDistance - THRESHOLD) {
      // 滑块到达终点，验证成功
      setIsVerified(true);
      setSliderX(maxDistance);
      // 生成一个简单的验证 token（MVP 版本）
      const token = `captcha_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      onVerify(token);
    } else {
      // 未到达终点，滑块回弹到起点
      setSliderX(0);
    }
  }, [getMaxDistance, onVerify]);

  /**
   * 使用 useEffect 绑定/解绑全局事件
   *
   * 为什么绑定到 document？
   * 因为用户拖动时鼠标可能移出滑块区域，绑定到 document 确保仍能接收事件。
   * 只在 isDragging 为 true 时绑定，结束后立即解绑。
   */
  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    const onEnd = () => handleEnd();

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onEnd);

    // 清理函数：组件卸载或 isDragging 变为 false 时解绑事件
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onEnd);
    };
  }, [isDragging, handleMove, handleEnd]);

  /**
   * 鼠标按下事件 - 开始拖动
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || isVerified) return;
    e.preventDefault();
    startXRef.current = e.clientX - sliderX;
    setIsDragging(true);
  };

  /**
   * 触摸开始事件 - 开始拖动（移动端支持）
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isVerified) return;
    startXRef.current = e.touches[0].clientX - sliderX;
    setIsDragging(true);
  };

  return (
    <div className="w-full">
      {/* 滑块轨道容器 */}
      <div
        ref={trackRef}
        className={`
          relative h-11 rounded-md overflow-hidden select-none
          border transition-all duration-200
          ${isVerified
            ? 'border-[var(--color-success)] bg-green-50'
            : disabled
              ? 'border-[var(--color-border)] bg-gray-50 opacity-60'
              : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
          }
        `}
      >
        {/* 已滑过区域的填充色 */}
        <div
          className={`
            absolute top-0 left-0 h-full transition-colors duration-200
            ${isVerified ? 'bg-green-100' : 'bg-[var(--color-accent-light)]'}
          `}
          style={{ width: `${sliderX + SLIDER_WIDTH}px` }}
        />

        {/* 轨道中间的提示文字 */}
        <div className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none">
          {isVerified ? (
            <span className="text-green-600 font-medium">✓ 验证成功</span>
          ) : (
            <span className="text-[var(--color-text-secondary)]">
              {disabled ? '请先输入手机号' : '向右拖动滑块完成验证'}
            </span>
          )}
        </div>

        {/* 可拖动的滑块按钮 */}
        <div
          className={`
            absolute top-0 h-full flex items-center justify-center
            w-11 rounded-md cursor-pointer
            transition-shadow duration-100
            ${isDragging ? 'shadow-md' : 'shadow-sm'}
            ${isVerified
              ? 'bg-green-500 text-white cursor-default'
              : disabled
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white text-[var(--color-text-primary)] hover:shadow-md'
            }
          `}
          style={{ left: `${sliderX}px` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {isVerified ? (
            /* 验证成功：显示对勾图标 */
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            /* 未验证：显示右箭头图标 */
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

export default SliderCaptcha;
