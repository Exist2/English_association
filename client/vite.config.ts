/**
 * Vite 构建配置文件
 *
 * 配置内容：
 * 1. React 插件 - 支持 JSX/TSX 和 React Fast Refresh（热更新）
 * 2. Tailwind CSS v4 插件 - 处理 Tailwind 样式（v4 使用 Vite 插件而非 PostCSS）
 * 3. 开发服务器代理 - 将 /api 请求转发到后端服务（避免跨域问题）
 */

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 将 defineConfig 的参数改为一个函数，解构出 mode
export default defineConfig(({ mode }) => {
  // 1. 加载环境变量
  // 因为你的变量名是 VITE_API_URL（带有 VITE_ 前缀），所以直接传两个参数即可
  const env = loadEnv(mode, process.cwd());

  // 2. 返回 Vite 配置对象
  return {
    plugins: [
      react(),
      tailwindcss(), // Tailwind CSS v4 Vite 插件
    ],
    server: {
      proxy: {
        "/api": {
          // 3. 在这里使用读取到的环境变量
          target: env.VITE_API_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
