import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Eye, EyeOff, UserPlus } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import HolographicText from '../components/ui/HolographicText'
import { useAuth } from '../lib/auth'
import { toast } from 'sonner'
import { useTranslation } from '../contexts/LanguageContext'

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
  const t = useTranslation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t.register.password_mismatch)
      return
    }

    if (password.length < 6) {
      setError(t.register.password_too_short)
      return
    }

    setLoading(true)

    try {
      await register(username, email, password)
      toast.success(t.register.register_success)
      navigate('/dashboard')
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } }
      setError(error.response?.data?.message || t.register.register_failed)
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
            <HolographicText color="gold">{t.register.title}</HolographicText>
          </h1>
          <p className="text-[#8888aa]">{t.register.register_subtitle}</p>
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
              label={t.register.username}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t.register.username_placeholder}
              icon={<User size={16} />}
              required
            />

            <Input
              label={t.register.email}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.register.email_placeholder}
              icon={<Mail size={16} />}
              required
            />

            <div className="relative">
              <Input
                label={t.register.password}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.register.password_placeholder}
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
              label={t.register.confirm_password}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t.register.confirm_password_placeholder}
              icon={<Lock size={16} />}
              required
            />

            <div className="p-3 rounded-lg bg-gold/5 border border-gold/15 text-xs text-[#aaa89a] leading-relaxed">
              <span className="text-gold font-medium">{t.common.risk_warning.split('：')[0]}：</span>{t.common.risk_warning.split('：')[1]}
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
                <><UserPlus size={18} /> {t.register.sign_up}</>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#8888aa]">
              {t.register.already_account}{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-cyan-glow hover:underline"
              >
                {t.register.login}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
