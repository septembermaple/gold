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

export default function Profile() {
  const { user, updateUser } = useAuth()
  const [username, setUsername] = useState(user?.username || '')
  const [email, setEmail] = useState(user?.email || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const res = await authApi.updateProfile({ username, email })
      updateUser(res.data.user || res.data)
      toast.success('个人信息更新成功')
    } catch {
      toast.error('更新失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的密码不一致')
      return
    }
    if (newPassword.length < 6) {
      toast.error('密码长度至少6位')
      return
    }
    setChangingPassword(true)
    try {
      await authApi.changePassword({ oldPassword, newPassword })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('密码修改成功')
    } catch {
      toast.error('密码修改失败，请检查原密码是否正确')
    } finally {
      setChangingPassword(false)
    }
  }

  const membershipInfo: Record<string, { name: string; color: 'cyan' | 'gold' | 'blue' | 'green'; features: string[] }> = {
    free: { name: '免费版', color: 'cyan', features: ['基础行情数据', '每日3次AI分析', '公开机构观点'] },
    basic: { name: '基础版', color: 'gold', features: ['实时行情数据', '每日30次AI分析', '看涨/看跌因子', '基础投资建议'] },
    pro: { name: '专业版', color: 'blue', features: ['全部行情数据', '无限AI分析', '全部因子分析', '专业投资建议', '智能推送'] },
    enterprise: { name: '企业版', color: 'green', features: ['全部专业版功能', '定制化分析', '专属投资策略', 'API接口', '专属客服'] },
  }

  const currentMembership = membershipInfo[user?.membershipLevel || 'free']

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#e0e0ff]">
          个人<HolographicText color="cyan">中心</HolographicText>
        </h1>
        <p className="text-sm text-[#8888aa] mt-1">管理您的账户信息与会员设置</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <GlowCard color="cyan">
            <div className="flex items-center gap-2 mb-6">
              <User size={18} className="text-cyan-glow" />
              <h3 className="text-lg font-semibold text-[#e0e0ff]">基本信息</h3>
            </div>
            <div className="space-y-4">
              <Input
                label="用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                icon={<User size={16} />}
              />
              <Input
                label="邮箱"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail size={16} />}
              />
              <div className="flex justify-end">
                <Button variant="primary" size="sm" onClick={handleSaveProfile} disabled={saving}>
                  <Save size={14} /> {saving ? '保存中...' : '保存修改'}
                </Button>
              </div>
            </div>
          </GlowCard>

          {/* Change Password */}
          <GlowCard color="gold">
            <div className="flex items-center gap-2 mb-6">
              <Key size={18} className="text-gold" />
              <h3 className="text-lg font-semibold text-[#e0e0ff]">修改密码</h3>
            </div>
            <div className="space-y-4">
              <Input
                label="当前密码"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入当前密码"
              />
              <Input
                label="新密码"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
              />
              <Input
                label="确认新密码"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
              />
              <div className="flex justify-end">
                <Button variant="gold" size="sm" onClick={handleChangePassword} disabled={changingPassword}>
                  <Key size={14} /> {changingPassword ? '修改中...' : '修改密码'}
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
                  升级会员
                </Button>
              )}
            </div>
          </GlowCard>

          {/* API Usage */}
          <GlowCard color="blue">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-electric-blue" />
              <h3 className="text-base font-semibold text-[#e0e0ff]">API 使用量</h3>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#8888aa]">已使用</span>
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
                <span className="text-[#8888aa]">配额上限</span>
                <span className="text-[#e0e0ff] font-mono">{user?.apiLimit || 100}</span>
              </div>
            </div>
          </GlowCard>

          {/* Account Info */}
          <GlowCard color="cyan">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={18} className="text-cyan-glow" />
              <h3 className="text-base font-semibold text-[#e0e0ff]">账户信息</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#8888aa]">注册时间</span>
                <span className="text-[#e0e0ff]">{user?.createdAt ? formatDate(user.createdAt) : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8888aa]">用户角色</span>
                <Badge variant={user?.role === 'admin' ? 'gold' : 'gray'} size="sm">
                  {user?.role === 'admin' ? '管理员' : '普通用户'}
                </Badge>
              </div>
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  )
}
