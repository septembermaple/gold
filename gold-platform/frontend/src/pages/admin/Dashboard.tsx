import { useState, useEffect } from 'react'
import { Users, CreditCard, Activity, TrendingUp, BarChart3, Zap } from 'lucide-react'
import GlowCard from '../../components/ui/GlowCard'
import HolographicText from '../../components/ui/HolographicText'
import Badge from '../../components/ui/Badge'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { adminApi } from '../../lib/api'
import { extractApiData, ensureArray } from '../../lib/utils'
import { toast } from 'sonner'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    todayNewUsers: 0,
    apiCallsToday: 0,
  })
  const [chartData, setChartData] = useState<Array<{ date: string; calls: number }>>([])
  const [membershipDist, setMembershipDist] = useState<Array<{ membership_level: string; count: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getAdminDashboard()
      const data = extractApiData(res)

      const users = data.users || {}
      const api = data.api || {}

      setStats({
        totalUsers: users.total_users || 0,
        activeUsers: users.active_users || 0,
        todayNewUsers: users.today_new_users || 0,
        apiCallsToday: api.total_calls || 0,
      })

      setChartData(ensureArray(data.apiTrend))
      setMembershipDist(ensureArray(data.memberships))
    } catch {
      toast.error('获取统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { label: '总用户数', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'cyan' as const },
    { label: '活跃用户', value: stats.activeUsers.toLocaleString(), icon: Activity, color: 'green' as const },
    { label: '今日新增', value: stats.todayNewUsers.toLocaleString(), icon: TrendingUp, color: 'gold' as const },
    { label: '今日API调用', value: stats.apiCallsToday.toLocaleString(), icon: Zap, color: 'blue' as const },
  ]

  const membershipColors: Record<string, string> = {
    free: 'text-cyan-glow',
    basic: 'text-gold',
    pro: 'text-electric-blue',
    enterprise: 'text-neon-green',
  }
  const membershipBgColors: Record<string, string> = {
    free: 'bg-cyan-glow/10',
    basic: 'bg-gold/10',
    pro: 'bg-electric-blue/10',
    enterprise: 'bg-neon-green/10',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-cyan-glow border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#e0e0ff]">
          管理<HolographicText color="gold">概览</HolographicText>
        </h1>
        <p className="text-sm text-[#8888aa] mt-1">系统运行数据与用户统计</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <GlowCard key={card.label} color={card.color}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#8888aa] mb-1">{card.label}</p>
                <p className="text-xl font-mono font-bold text-[#e0e0ff]">{card.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                card.color === 'cyan' ? 'bg-cyan-glow/10 text-cyan-glow' :
                card.color === 'green' ? 'bg-neon-green/10 text-neon-green' :
                card.color === 'gold' ? 'bg-gold/10 text-gold' :
                'bg-electric-blue/10 text-electric-blue'
              }`}>
                <card.icon size={20} />
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#e0e0ff]">
                <BarChart3 size={16} className="inline mr-1.5 text-cyan-glow" />
                API调用趋势
              </h3>
              <Badge variant="cyan">近7天</Badge>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="apiGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} />
                  <YAxis tick={{ fill: '#8888aa', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(13,13,43,0.9)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '8px', color: '#e0e0ff', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="calls" stroke="#00f0ff" strokeWidth={2} fill="url(#apiGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Membership Distribution */}
      {membershipDist.length > 0 && (
        <GlowCard color="gold">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-gold" />
            <h3 className="text-base font-semibold text-[#e0e0ff]">会员分布</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {membershipDist.map(({ membership_level, count }) => {
              const level = membership_level || 'free'
              return (
                <div key={level} className={`${membershipBgColors[level] || 'bg-cyan-glow/10'} rounded-lg p-4 text-center`}>
                  <p className={`text-2xl font-mono font-bold ${membershipColors[level] || 'text-cyan-glow'}`}>{count.toLocaleString()}</p>
                  <p className="text-xs text-[#8888aa] mt-1">{level.toUpperCase()}</p>
                </div>
              )
            })}
          </div>
        </GlowCard>
      )}
    </div>
  )
}
