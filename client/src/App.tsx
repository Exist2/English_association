/**
 * 应用根组件
 *
 * 负责：
 * 1. 配置 React Router 路由系统
 * 2. 定义页面路由映射关系
 * 3. 使用 AuthGuard 保护需要登录的页面
 *
 * 路由结构：
 * - /login  → 登录页（公开访问）
 * - /editor → 编辑器页（需要登录）
 * - /       → 默认重定向到编辑器页
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import EditorPage from './pages/EditorPage';
import AuthGuard from './components/AuthGuard';

/**
 * App - 应用根组件
 *
 * BrowserRouter: 使用 HTML5 History API 管理路由（URL 不带 # 号）
 * Routes: 路由容器，只渲染第一个匹配的 Route
 * Route: 定义 URL 路径与组件的映射关系
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 登录页 - 公开访问，无需认证 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 编辑器页 - 需要登录才能访问，使用 AuthGuard 保护 */}
        <Route
          path="/editor"
          element={
            <AuthGuard>
              <EditorPage />
            </AuthGuard>
          }
        />

        {/* 默认路由 - 访问根路径时重定向到编辑器页 */}
        <Route path="*" element={<Navigate to="/editor" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
