import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, LogIn, User } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import HolographicText from '../components/ui/HolographicText'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { useTranslation } from '../contexts/LanguageContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const t = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(account, password)
      toast.success(t.login.login_success)
      navigate('/dashboard')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(error.response?.data?.message || t.login.login_failed)
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
            <HolographicText color="cyan">{t.login.title}</HolographicText>
          </h1>
          <p className="text-[#8888aa]">{t.login.login_subtitle}</p>
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
              label={t.login.email}
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder={t.login.email_placeholder}
              icon={<User size={16} />}
              required
            />

            <div className="relative">
              <Input
                label={t.login.password}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.login.password_placeholder}
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
                <><LogIn size={18} /> {t.login.sign_in}</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#8888aa]">
              {t.login.no_account}{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-cyan-glow hover:underline"
              >
                {t.login.register}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
