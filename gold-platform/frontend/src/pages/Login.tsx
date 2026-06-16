import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, LogIn, User } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import HolographicText from '../components/ui/HolographicText'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(account, password)
      toast.success('登录成功')
      navigate('/dashboard')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(error.response?.data?.message || '登录失败，请检查账号和密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 grid-bg flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-cyan-glow/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-electric-blue/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-glow to-electric-blue flex items-center justify-center mx-auto mb-4 glow-border">
            <span className="text-dark-900 font-bold text-2xl">Au</span>
          </div>
          <h1 className="text-3xl font-bold text-[#e0e0ff] mb-2">
            <HolographicText color="cyan">登录</HolographicText>
          </h1>
          <p className="text-[#8888aa]">登录您的 GoldAI 账户</p>
        </div>

        {/* Form */}
        <div className="glass p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-neon-red/10 border border-neon-red/20 text-sm text-neon-red">
                {error}
              </div>
            )}

            <Input
              label="邮箱 / 用户名"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="请输入邮箱或用户名"
              icon={<User size={16} />}
              required
            />

            <div className="relative">
              <Input
                label="密码"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                icon={<Lock size={16} />}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[38px] text-[#8888aa] hover:text-[#e0e0ff] transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              glow
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-glow/20 border-t-cyan-glow" />
              ) : (
                <><LogIn size={18} /> 登录</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#8888aa]">
              还没有账户？{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-cyan-glow hover:underline"
              >
                立即注册
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
