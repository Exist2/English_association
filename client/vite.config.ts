 /**
 * Vite 构建配置文件
 *
 * 配置内容：
 * 1. React 插件 - 支持 JSX/TSX 和 React Fast Refresh（热更新）
 * 2. Tailwind CSS v4 插件 - 处理 Tailwind 样式（v4 使用 Vite 插件而非 PostCSS）
 * 3. 开发服务器代理 - 将 /api 请求转发到后端服务（避免跨域问题）
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tailwind CSS v4 Vite 插件
  ],
  server: {
    /**
     * 开发服务器代理配置
     *
     * 将前端发出的 /api 开头的请求转发到后端服务器（http://localhost:3000）
     * 这样前端开发时不会遇到跨域（CORS）问题
     *
     * 例如：前端请求 /api/documents → 实际转发到 http://localhost:3000/api/documents
     */
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // 后端服务地址
        changeOrigin: true,              // 修改请求头中的 Origin 字段
      },
    },
  },
})
