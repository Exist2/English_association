/**
 * useDebounce Hook - 通用防抖逻辑
 *
 * 功能：
 * 接收一个值和延迟时间，返回防抖后的值。
 * 只有当输入值在指定延迟时间内没有再次变化时，才会更新返回值。
 *
 * 使用场景：
 * - 搜索输入框：用户停止输入后才发送请求
 * - 联想功能：用户停止输入 500ms 后才触发联想 API
 *
 * 原理：
 * 每次 value 变化时，设置一个定时器。如果在定时器到期前 value 又变了，
 * 就取消旧定时器、设置新定时器。只有最后一次变化后等待 delay 毫秒，
 * 才会真正更新 debouncedValue。
 *
 * 使用方式：
 * const debouncedText = useDebounce(inputText, 500);
 */

import { useState, useEffect } from 'react';

/**
 * 通用防抖 Hook
 *
 * @param value - 需要防抖的值（任意类型）
 * @param delay - 防抖延迟时间（毫秒）
 * @returns 防抖后的值，只在 value 稳定 delay 毫秒后才更新
 *
 * @example
 * ```tsx
 * const [text, setText] = useState('');
 * const debouncedText = useDebounce(text, 500);
 *
 * useEffect(() => {
 *   // 只在用户停止输入 500ms 后才执行
 *   fetchResults(debouncedText);
 * }, [debouncedText]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  // 存储防抖后的值
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    /**
     * 设置定时器：delay 毫秒后更新 debouncedValue
     *
     * setTimeout 返回一个定时器 ID，用于后续取消
     */
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    /**
     * 清理函数：在下一次 effect 执行前（即 value 或 delay 变化时）取消定时器
     *
     * 这就是防抖的核心：如果 value 在 delay 内又变了，
     * 旧的定时器被取消，新的定时器重新开始计时
     */
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
