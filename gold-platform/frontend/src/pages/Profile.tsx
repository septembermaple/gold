import { useState } from 'react'
import { User, Mail, Crown, Key, Save, BarChart3, Calendar } from 'lucide-react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import { useAuth } from '../lib/auth'
import { authApi } from '../lib/api'
import { formatDate } from '../lib/utils'
import { toast } from 'sonner'
import { useTranslation } from '../contexts/LanguageContext'

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const t = useTranslation()

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await authApi.updateProfile({ username, email })
      updateUser(res.data.user || res.data)
      toast.success(t.profile.update_success)
    } catch {
      toast.error(t.profile.update_failed)
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error(t.profile.password_mismatch)
      return
    }
    if (newPassword.length < 6) {
      toast.error(t.profile.password_too_short)
      return
    }
    setChangingPassword(true)
    try {
      await authApi.changePassword({ oldPassword, newPassword })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success(t.profile.password_change_success)
    } catch {
      toast.error(t.profile.password_change_failed)
    } finally {
      setChangingPassword(false)
    }
  }

  const membershipInfo: Record<string, { name: string; color: 'cyan' | 'gold' | 'blue' | 'green'; features: string[] }> = {
    free: { name: t.profile.free, color: 'cyan', features: [t.profile.free_features] },
    basic: { name: t.profile.basic, color: 'gold', features: [t.profile.basic_features] },
    pro: { name: t.profile.pro, color: 'blue', features: [t.profile.pro_features] },
    enterprise: { name: t.profile.enterprise, color: 'green', features: [t.profile.enterprise_features] },
  }

  const currentMembership = membershipInfo[user?.membershipLevel || 'free']

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#e0e0ff]">
          {t.profile.title_part1}<HolographicText color="cyan">{t.profile.title_part2}</HolographicText>
        </h1>
        <p className="text-sm text-[#8888aa] mt-1">{t.profile.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <GlowCard color="cyan">
            <div className="flex items-center gap-2 mb-6">
              <User size={18} className="text-cyan-glow" />
              <h3 className="text-lg font-semibold text-[#e0e0ff]">{t.profile.basic_info}</h3>
            </div>
            <div className="space-y-4">
              <Input
                label={t.profile.username}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                icon={<User size={16} />}
              />
              <Input
                label={t.profile.email}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail size={16} />}
              />
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={handleSaveProfile} disabled={saving}>
                  <Save size={14} /> {saving ? t.profile.saving : t.profile.save}
                </Button>
              </div>
            </div>
          </GlowCard>

          {/* Change Password */}
          <GlowCard color="gold">
            <div className="flex items-center gap-2 mb-6">
              <Key size={18} className="text-gold" />
              <h3 className="text-lg font-semibold text-[#e0e0ff]">{t.profile.change_password}</h3>
            </div>
            <div className="space-y-4">
              <Input
                label={t.profile.current_password}
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder={t.profile.current_password_placeholder}
              />
              <Input
                label={t.profile.new_password}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t.profile.new_password_placeholder}
              />
              <Input
                label={t.profile.confirm_new_password}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t.profile.confirm_new_password_placeholder}
              />
              <div className="flex justify-end">
                <Button variant="gold" size="sm" onClick={handleChangePassword} disabled={changingPassword}>
                  <Key size={14} /> {changingPassword ? t.profile.changing : t.profile.change_password}
                </Button>
              </div>
            </div>
          </GlowCard>
        </div>

        {/* Right Column - Membership & Stats */}
        <div className="space-y-6">
          {/* Membership Card */}
          <GlowCard color={currentMembership.color}>
            <div className="text-center">
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
                currentMembership.color === 'cyan' ? 'bg-cyan-glow/10' :
                currentMembership.color === 'gold' ? 'bg-gold/10' :
                currentMembership.color === 'blue' ? 'bg-electric-blue/10' :
                'bg-neon-green/10'
              }`}>
                <Crown size={32} className={
                  currentMembership.color === 'cyan' ? 'text-cyan-glow' :
                  currentMembership.color === 'gold' ? 'text-gold' :
                  currentMembership.color === 'blue' ? 'text-electric-blue' :
                  'text-neon-green'
                } />
              </div>
              <h3 className="text-xl font-bold text-[#e0e0ff] mb-1">{currentMembership.name}</h3>
              <Badge variant={currentMembership.color} size="md" className="mb-4">
                {user?.membershipLevel?.toUpperCase() || 'FREE'}
              </Badge>
              <div className="space-y-2 text-left mt-4">
                {currentMembership.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-[#e0e0ff]">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-glow" />
                    {feature}
                  </div>
                ))}
              </div>
              {user?.membershipLevel !== 'enterprise' && (
                <Button variant="gold" size="sm" glow className="w-full mt-4">
                  {t.profile.upgrade_membership}
                </Button>
              )}
            </div>
          </GlowCard>

          {/* API Usage */}
          <GlowCard color="blue">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-electric-blue" />
              <h3 className="text-base font-semibold text-[#e0e0ff]">{t.profile.api_usage}</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#8888aa]">{t.profile.used}</span>
                  <span className="text-[#e0e0ff] font-mono">{user?.apiUsage || 0}</span>
                </div>
                <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-glow to-electric-blue rounded-full transition-all"
                    style={{ width: `${Math.min(((user?.apiUsage || 0) / (user?.apiLimit || 100)) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#8888aa]">{t.profile.quota_limit}</span>
                <span className="text-[#e0e0ff] font-mono">{user?.apiLimit || 100}</span>
              </div>
            </div>
          </GlowCard>

          {/* Account Info */}
          <GlowCard color="cyan">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-cyan-glow" />
              <h3 className="text-base font-semibold text-[#e0e0ff]">{t.profile.account_info}</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8888aa]">{t.profile.register_time}</span>
                <span className="text-[#e0e0ff]">{user?.createdAt ? formatDate(user.createdAt) : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8888aa]">{t.profile.user_role}</span>
                <Badge variant={user?.role === 'admin' ? 'gold' : 'gray'} size="sm">
                  {user?.role === 'admin' ? t.profile.admin : t.profile.normal_user}
                </Badge>
              </div>
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  )
}
