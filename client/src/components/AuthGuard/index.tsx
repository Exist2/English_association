/**
 * 认证守卫组件
 *
 * 用于保护需要登录才能访问的页面。
 * 工作原理：检查 localStorage 中是否存在 'accessToken'，
 * - 如果存在：渲染子组件（即允许访问受保护的页面）
 * - 如果不存在：重定向到登录页面
 *
 * 使用方式：在路由中包裹需要保护的页面组件
 * <Route path="/editor" element={<AuthGuard><EditorPage /></AuthGuard>} />
 */

import { Navigate } from 'react-router-dom';

/**
 * AuthGuard 组件的 Props 接口
 */
interface AuthGuardProps {
  /** 需要被保护的子组件 */
  children: React.ReactNode;
}

/**
 * AuthGuard - 认证守卫
 * 检查用户是否已登录（localStorage 中是否有 accessToken）
 *
 * @param props.children - 受保护的子组件
 * @returns 如果已登录返回子组件，否则重定向到登录页
 */
function AuthGuard({ children }: AuthGuardProps) {
  // 从 localStorage 获取 JWT 令牌
  const token = localStorage.getItem('accessToken');

  // 如果没有令牌，说明用户未登录，重定向到登录页
  // replace 属性表示替换当前历史记录，用户点击"后退"不会回到受保护页面
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 令牌存在，允许访问受保护的内容
  return <>{children}</>;
}

export default AuthGuard;
