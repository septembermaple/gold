import { useState, useEffect, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, RefreshCw,
  CheckCircle2, XCircle, Minus, Star, Signal
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { macroApi } from '../lib/api'
import { ensureArray, extractApiData } from '../lib/utils'
import { toast } from 'sonner'

interface SignalItem {
  title?: string
  detail?: string
  strength?: number
  category?: string
}

interface DashboardData {
  signals?: {
    bullish?: SignalItem[]
    bearish?: SignalItem[]
  }
  overallSignal?: {
    direction?: string
    score?: number
    bullishScore?: number
    bearishScore?: number
    label?: string
  }
}

const SignalIcon = ({ direction }: { direction?: string }) => {
  if (direction === 'bullish') return <TrendingUp size={48} className="text-neon-green" />
  if (direction === 'bearish') return <TrendingDown size={48} className="text-neon-red" />
  return <Minus size={48} className="text-[#8888aa]" />
}

const SignalLabel = ({ direction, label }: { direction?: string; label?: string }) => {
  if (direction === 'bullish') return <span className="text-neon-green glow-text">{label || '看多'}</span>
  if (direction === 'bearish') return <span className="text-neon-red glow-text">{label || '看空'}</span>
  return <span className="text-[#8888aa]">{label || '中性'}</span>
}

const StrengthStars = ({ strength }: { strength?: number }) => {
  const level = Math.min(Math.max(strength ?? 0, 0), 5)
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={12}
          className={i <= level ? 'text-gold fill-gold' : 'text-[#8888aa]/30'}
        />
      ))}
    </div>
  )
}

export default function SignalsPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await macroApi.getDashboard()
      const d = extractApiData(res) as DashboardData
      setData(d)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误'
      toast.error('加载信号数据失败', { description: message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => { await fetchData() }
    init()
  }, [fetchData])

  if (loading && !data) return <Loading text="加载多空信号..." />

  const bullishSignals = ensureArray<SignalItem>(data?.signals?.bullish)
  const bearishSignals = ensureArray<SignalItem>(data?.signals?.bearish)
  const overall = data?.overallSignal

  const barData = [
    { name: '看多信号', value: overall?.bullishScore ?? bullishSignals.length, fill: '#00ff88' },
    { name: '看空信号', value: overall?.bearishScore ?? bearishSignals.length, fill: '#ff3366' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            <HolographicText as="span" color="mixed">多空信号</HolographicText>面板
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">实时市场多空信号综合分析</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw size={14} /> 刷新
        </Button>
      </div>

      {/* Overall Signal Indicator */}
      <GlowCard
        color={overall?.direction === 'bullish' ? 'green' : overall?.direction === 'bearish' ? 'red' : 'cyan'}
        className="text-center py-8"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse-glow">
            <SignalIcon direction={overall?.direction} />
          </div>
          <div>
            <h2 className="text-3xl font-bold mb-1">
              <SignalLabel direction={overall?.direction} label={overall?.label} />
            </h2>
            <p className="text-sm text-[#8888aa]">
              综合信号评分: <span className="font-mono text-[#e0e0ff]">{overall?.score?.toFixed(1) ?? '--'}</span>
            </p>
          </div>
          <div className="flex gap-4 mt-2">
            <div className="text-center">
              <p className="text-xs text-[#8888aa]">看多得分</p>
              <p className="text-lg font-mono font-bold text-neon-green">{overall?.bullishScore?.toFixed(1) ?? '--'}</p>
            </div>
            <div className="w-px bg-[rgba(0,240,255,0.15)]" />
            <div className="text-center">
              <p className="text-xs text-[#8888aa]">看空得分</p>
              <p className="text-lg font-mono font-bold text-neon-red">{overall?.bearishScore?.toFixed(1) ?? '--'}</p>
            </div>
          </div>
        </div>
      </GlowCard>

      {/* Signal Strength Bar Chart */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#e0e0ff]">
            <Signal size={16} className="inline mr-1.5 text-cyan-glow" />
            信号强度对比
          </h3>
          <Badge variant="cyan">Strength</Badge>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
              <XAxis type="number" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#8888aa', fontSize: 12 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} width={80} />
              <Tooltip
                cursor={{ fill: 'rgba(0, 240, 255, 0.1)' }}
                contentStyle={{
                  background: 'linear-gradient(135deg, rgba(13, 13, 43, 0.95) 0%, rgba(20, 20, 60, 0.95) 100%)',
                  border: '1px solid rgba(0, 240, 255, 0.25)',
                  borderRadius: '12px',
                  color: '#e0e0ff',
                  fontSize: '13px',
                  padding: '12px 16px',
                  boxShadow: '0 8px 32px rgba(0, 240, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
                }}
                formatter={(value: number) => [
                  <span className="font-semibold text-lg">{value}</span>,
                  <span className="text-[#8888aa] text-xs">信号强度</span>
                ]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Signal Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bullish Signals */}
        <div>
          <h2 className="text-lg font-semibold text-[#e0e0ff] mb-3 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-neon-green" />
            看多信号
            <Badge variant="green" size="md">{bullishSignals.length}</Badge>
          </h2>
          <div className="space-y-3">
            {bullishSignals.length === 0 ? (
              <div className="glass-dark p-6 text-center">
                <p className="text-sm text-[#8888aa]">暂无看多信号</p>
              </div>
            ) : (
              bullishSignals.map((signal, i) => (
                <GlowCard key={i} color="green" className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-neon-green" />
                  <div className="pl-3">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-semibold text-neon-green">{signal.title || `看多信号 ${i + 1}`}</h4>
                      <StrengthStars strength={signal.strength} />
                    </div>
                    <p className="text-xs text-[#8888aa] leading-relaxed">{signal.detail || '暂无详情'}</p>
                    {signal.category && (
                      <Badge variant="green" size="sm" className="mt-2">{signal.category}</Badge>
                    )}
                  </div>
                </GlowCard>
              ))
            )}
          </div>
        </div>

        {/* Bearish Signals */}
        <div>
          <h2 className="text-lg font-semibold text-[#e0e0ff] mb-3 flex items-center gap-2">
            <XCircle size={18} className="text-neon-red" />
            看空信号
            <Badge variant="red" size="md">{bearishSignals.length}</Badge>
          </h2>
          <div className="space-y-3">
            {bearishSignals.length === 0 ? (
              <div className="glass-dark p-6 text-center">
                <p className="text-sm text-[#8888aa]">暂无看空信号</p>
              </div>
            ) : (
              bearishSignals.map((signal, i) => (
                <GlowCard key={i} color="red" className="relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-neon-red" />
                  <div className="pl-3">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className="text-sm font-semibold text-neon-red">{signal.title || `看空信号 ${i + 1}`}</h4>
                      <StrengthStars strength={signal.strength} />
                    </div>
                    <p className="text-xs text-[#8888aa] leading-relaxed">{signal.detail || '暂无详情'}</p>
                    {signal.category && (
                      <Badge variant="red" size="sm" className="mt-2">{signal.category}</Badge>
                    )}
                  </div>
                </GlowCard>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
