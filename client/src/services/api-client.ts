/**
 * API 客户端配置文件
 *
 * 基于 Axios 封装的 HTTP 客户端，提供：
 * 1. 统一的 baseURL 配置（从环境变量读取）
 * 2. 请求拦截器：自动在请求头中附加 JWT 令牌
 * 3. 响应拦截器：处理 401 未授权错误（自动跳转登录页）
 * 4. 统一的错误处理
 *
 * 使用方式：
 * import { apiClient } from '@/services/api-client';
 * const response = await apiClient.get('/documents');
 */

import axios from 'axios';

/**
 * API 基础地址
 * 从 Vite 环境变量 VITE_API_BASE_URL 读取，默认为本地开发地址
 *
 * 说明：Vite 中以 VITE_ 开头的环境变量会被暴露给客户端代码，
 * 通过 import.meta.env.VITE_XXX 访问
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * 创建 Axios 实例
 * 设置基础配置，所有通过此实例发出的请求都会使用这些默认配置
 */
const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000, // 请求超时时间：10秒
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器
 *
 * 在每个请求发出之前执行，用于：
 * - 从 localStorage 获取 JWT 令牌
 * - 将令牌添加到请求头的 Authorization 字段
 *
 * 这样后端就能通过请求头识别当前用户身份
 */
apiClient.interceptors.request.use(
  (config) => {
    // 从 localStorage 获取存储的 JWT 令牌
    const token = localStorage.getItem('accessToken');

    // 如果令牌存在，添加到请求头
    // 格式：Authorization: Bearer <token>（这是 JWT 的标准格式）
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    // 请求配置出错时直接拒绝
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 *
 * 在收到响应后执行，用于：
 * - 正常响应：直接返回
 * - 401 错误：令牌过期或无效，清除本地令牌并跳转到登录页
 * - 其他错误：统一格式化错误信息
 */
apiClient.interceptors.response.use(
  // 成功响应直接返回
  (response) => response,
  (error) => {
    // 处理 HTTP 错误响应
    if (error.response) {
      const { status } = error.response;

      // 401 未授权：令牌过期或无效
      if (status === 401) {
        // 清除本地存储的令牌
        localStorage.removeItem('accessToken');

        // 跳转到登录页（使用 window.location 而非 React Router，
        // 因为拦截器在 React 组件树之外，无法使用 useNavigate）
        window.location.href = '/login';
      }
    }

    // 将错误继续抛出，让调用方可以进行额外处理
    return Promise.reject(error);
  }
);

export { apiClient };
