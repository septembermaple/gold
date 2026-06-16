import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, ShieldAlert, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle2, Compass
} from 'lucide-react'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { macroApi } from '../lib/api'
import { extractApiData } from '../lib/utils'
import { toast } from 'sonner'

interface RiskItem {
  riskLevel?: string
  riskScore?: number
  keyFactors?: string[]
  riskSignals?: string[]
  opportunitySignals?: string[]
  positionAdvice?: string
}

interface OutlookPeriod {
  direction?: string
  confidence?: number
  drivers?: string[]
  summary?: string
}

interface DashboardData {
  riskMatrix?: {
    physicalGold?: RiskItem
    goldEtf?: RiskItem
    goldFutures?: RiskItem
    goldMining?: RiskItem
  }
  outlook?: {
    shortTerm?: OutlookPeriod
    midTerm?: OutlookPeriod
    longTerm?: OutlookPeriod
  }
}

const riskLevelConfig: Record<string, { color: string; variant: 'green' | 'gold' | 'red'; label: string }> = {
  low: { color: '#00ff88', variant: 'green', label: '低风险' },
  medium: { color: '#fbbf24', variant: 'gold', label: '中风险' },
  high: { color: '#ff3366', variant: 'red', label: '高风险' },
}

const directionConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  bullish: { icon: <TrendingUp size={20} />, color: '#00ff88', label: '看涨' },
  bearish: { icon: <TrendingDown size={20} />, color: '#ff3366', label: '看跌' },
  neutral: { icon: <Minus size={20} />, color: '#8888aa', label: '中性' },
}

function RiskCard({ title, icon, data }: { title: string; icon: React.ReactNode; data?: RiskItem }) {
  const level = riskLevelConfig[data?.riskLevel ?? 'medium']

  return (
    <GlowCard color={level.variant} className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
        {icon}
      </div>
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-[#e0e0ff] flex items-center gap-2">
            {icon}
            {title}
          </h4>
          <Badge variant={level.variant} size="md">{level.label}</Badge>
        </div>

        {/* Risk Score */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[#8888aa]">风险分数</span>
            <span className="text-sm font-mono font-bold" style={{ color: level.color }}>
              {data?.riskScore?.toFixed(1) ?? '--'}
            </span>
          </div>
          <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min((data?.riskScore ?? 0) * 100, 100)}%`,
                backgroundColor: level.color,
                boxShadow: `0 0 8px ${level.color}40`
              }}
            />
          </div>
        </div>

        {/* Key Factors */}
        {data?.keyFactors && data.keyFactors.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-[#8888aa] mb-1">关键因子</p>
            <div className="flex flex-wrap gap-1">
              {data.keyFactors.map((f, i) => (
                <Badge key={i} variant="gray" size="sm">{f}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Risk Signals */}
        {data?.riskSignals && data.riskSignals.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-[#8888aa] mb-1 flex items-center gap-1">
              <AlertTriangle size={10} className="text-neon-red" /> 风险信号
            </p>
            <ul className="space-y-0.5">
              {data.riskSignals.map((s, i) => (
                <li key={i} className="text-xs text-neon-red/80 flex items-start gap-1">
                  <span className="mt-1">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Opportunity Signals */}
        {data?.opportunitySignals && data.opportunitySignals.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-[#8888aa] mb-1 flex items-center gap-1">
              <CheckCircle2 size={10} className="text-neon-green" /> 机会信号
            </p>
            <ul className="space-y-0.5">
              {data.opportunitySignals.map((s, i) => (
                <li key={i} className="text-xs text-neon-green/80 flex items-start gap-1">
                  <span className="mt-1">•</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Position Advice */}
        {data?.positionAdvice && (
          <div className="mt-3 pt-3 border-t border-[rgba(0,240,255,0.06)]">
            <p className="text-xs text-[#8888aa] mb-1">仓位建议</p>
            <p className="text-xs text-[#e0e0ff]">{data.positionAdvice}</p>
          </div>
        )}
      </div>
    </GlowCard>
  )
}

function OutlookCard({ title, data }: { title: string; data?: OutlookPeriod }) {
  const dir = directionConfig[data?.direction ?? 'neutral']

  return (
    <GlowCard
      color={data?.direction === 'bullish' ? 'green' : data?.direction === 'bearish' ? 'red' : 'cyan'}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-[#e0e0ff]">{title}</h4>
        <div className="flex items-center gap-1.5" style={{ color: dir.color }}>
          {dir.icon}
          <span className="text-sm font-bold">{dir.label}</span>
        </div>
      </div>

      {/* Confidence */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#8888aa]">置信度</span>
          <span className="text-xs font-mono" style={{ color: dir.color }}>
            {data?.confidence !== undefined ? `${(data.confidence * 100).toFixed(0)}%` : '--'}
          </span>
        </div>
        <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(data?.confidence ?? 0) * 100}%`,
              backgroundColor: dir.color,
              boxShadow: `0 0 8px ${dir.color}40`
            }}
          />
        </div>
      </div>

      {/* Drivers */}
      {data?.drivers && data.drivers.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-[#8888aa] mb-1">驱动因子</p>
          <div className="flex flex-wrap gap-1">
            {data.drivers.map((d, i) => (
              <Badge key={i} variant="gray" size="sm">{d}</Badge>
            ))}
          </div>
      </div>
      )}

      {/* Summary */}
      {data?.summary && (
        <p className="text-xs text-[#8888aa] leading-relaxed">{data.summary}</p>
      )}
    </GlowCard>
  )
}

export default function RiskPage() {
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
      toast.error('加载风险评估数据失败', { description: message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => { await fetchData() }
    init()
  }, [fetchData])

  if (loading && !data) return <Loading text="加载风险评估数据..." />

  const rm = data?.riskMatrix
  const outlook = data?.outlook

  const riskCards = [
    { title: '实物黄金', icon: <ShieldAlert size={16} className="text-gold" />, data: rm?.physicalGold },
    { title: '黄金ETF', icon: <ShieldAlert size={16} className="text-cyan-glow" />, data: rm?.goldEtf },
    { title: '黄金期货', icon: <ShieldAlert size={16} className="text-electric-blue" />, data: rm?.goldFutures },
    { title: '金矿股', icon: <ShieldAlert size={16} className="text-neon-red" />, data: rm?.goldMining },
  ]

  const outlookCards = [
    { title: '短期展望', data: outlook?.shortTerm },
    { title: '中期展望', data: outlook?.midTerm },
    { title: '长期展望', data: outlook?.longTerm },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            <HolographicText as="span" color="red">风险评估</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">多品种风险矩阵与走势预期分析</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw size={14} /> 刷新
        </Button>
      </div>

      {/* Risk Matrix */}
      <div>
        <h2 className="text-lg font-semibold text-[#e0e0ff] mb-3 flex items-center gap-2">
          <ShieldAlert size={18} className="text-neon-red" />
          风险矩阵
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {riskCards.map((card) => (
            <RiskCard key={card.title} {...card} />
          ))}
        </div>
      </div>

      {/* Outlook */}
      <div>
        <h2 className="text-lg font-semibold text-[#e0e0ff] mb-3 flex items-center gap-2">
          <Compass size={18} className="text-cyan-glow" />
          走势预期
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {outlookCards.map((card) => (
            <OutlookCard key={card.title} {...card} />
          ))}
        </div>
      </div>
    </div>
  )
}
