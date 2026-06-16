import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { authApi } from './api'
import { hashPasswordClient } from './utils'

interface User {
  id: string
  username: string
  email: string
  role: string
  membershipLevel: string
  avatar?: string
  apiUsage?: number
  apiLimit?: number
  createdAt: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      authApi.getMe()
        .then((res) => {
          const payload = res.data.data || res.data
          setUser(payload.user || payload)
        })
        .catch(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setToken(null)
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (account: string, password: string) => {
    // 客户端哈希密码，避免明文传输
    const hashedPassword = await hashPasswordClient(password)
    const isEmail = account.includes('@')
    const loginData = isEmail
      ? { email: account, password: hashedPassword }
      : { username: account, password: hashedPassword }
    const res = await authApi.login(loginData)
    // API 返回 { success: true, data: { user, token } }，axios 解包后 res.data = { success, data: { user, token } }
    const payload = res.data.data || res.data
    const newToken = payload.token
    const newUser = payload.user
    if (!newToken) throw new Error('登录响应缺少 token')
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const register = async (username: string, email: string, password: string) => {
    // 客户端哈希密码，避免明文传输
    const hashedPassword = await hashPasswordClient(password)
    const res = await authApi.register({ username, email, password: hashedPassword })
    const payload = res.data.data || res.data
    const newToken = payload.token
    const newUser = payload.user
    if (!newToken) throw new Error('注册响应缺少 token')
    localStorage.setItem('token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }

  const updateUser = (newUser: User) => {
    setUser(newUser)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-glow border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-900">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-cyan-glow border-t-transparent" />
      </div>
    )
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

export function MembershipGate({ level, children, fallback }: { level: string; children: ReactNode; fallback?: ReactNode }) {
  const { user } = useAuth()
  const levels = ['free', 'basic', 'pro', 'enterprise']
  const userLevelIndex = levels.indexOf(user?.membershipLevel || 'free')
  const requiredLevelIndex = levels.indexOf(level)

  if (userLevelIndex < requiredLevelIndex) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
