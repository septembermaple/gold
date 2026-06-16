import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, UserPlus } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import HolographicText from '../components/ui/HolographicText'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 6) {
      setError('密码长度至少6位')
      return
    }

    setLoading(true)

    try {
      await register(username, email, password)
      toast.success('注册成功')
      navigate('/dashboard')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(error.response?.data?.message || '注册失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 grid-bg flex items-center justify-center relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-gold/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/4 w-80 h-80 bg-cyan-glow/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center mx-auto mb-4 glow-border-gold">
            <span className="text-dark-900 font-bold text-2xl">Au</span>
          </div>
          <h1 className="text-3xl font-bold text-[#e0e0ff] mb-2">
            <HolographicText color="gold">注册</HolographicText>
          </h1>
          <p className="text-[#8888aa]">创建您的 GoldAI 账户</p>
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
              label="用户名"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              icon={<User size={16} />}
              required
            />

            <Input
              label="邮箱"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              icon={<Mail size={16} />}
              required
            />

            <div className="relative">
              <Input
                label="密码"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码（至少6位）"
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

            <Input
              label="确认密码"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
              icon={<Lock size={16} />}
              required
            />

            <div className="p-3 rounded-lg bg-gold/5 border border-gold/15 text-xs text-[#aaa89a] leading-relaxed">
              <span className="text-gold font-medium">风险提示：</span>本平台提供的数据分析与AI解读仅供学习参考，不构成任何投资建议。金融市场存在较大风险，投资需谨慎，请根据自身情况独立判断并承担相应风险。
            </div>

            <Button
              type="submit"
              variant="gold"
              size="lg"
              glow
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gold/20 border-t-gold" />
              ) : (
                <><UserPlus size={18} /> 注册</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#8888aa]">
              已有账户？{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-cyan-glow hover:underline"
              >
                立即登录
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
