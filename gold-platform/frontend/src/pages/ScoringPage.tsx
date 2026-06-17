import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Award, Scale, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { macroApi } from '../lib/api'
import { ensureArray, extractApiData } from '../lib/utils'
import { toast } from 'sonner'
import { useTranslation } from '../contexts/LanguageContext'

interface SignalItem {
  title?: string
  detail?: string
  strength?: number
}

interface DimensionScore {
  name?: string
  weight?: number
  score?: number
  description?: string
}

interface TenDimensionScore {
  shortTerm?: {
    label?: string
    weight?: number
    dimensions?: DimensionScore[]
  }
  midTerm?: {
    label?: string
    weight?: number
    dimensions?: DimensionScore[]
  }
  longTerm?: {
    label?: string
    weight?: number
    dimensions?: DimensionScore[]
  }
  totalScore?: number
  investmentSignal?: string
  actionAdvice?: string
}

interface DashboardData {
  overallSignal?: {
    direction?: string
    score?: number
    bullishScore?: number
    bearishScore?: number
    label?: string
  }
  tenDimensionScore?: TenDimensionScore
  signals?: {
    bullish?: SignalItem[]
    bearish?: SignalItem[]
  }
}

const signalConfig: Record<string, { color: string; bgColor: string; icon: React.ReactNode; label: string }> = {
  'strong_buy': { color: '#00ff88', bgColor: 'bg-neon-green/10 border-neon-green/30', icon: <TrendingUp size={32} />, label: '强烈买入' },
  'buy': { color: '#00ff88', bgColor: 'bg-neon-green/10 border-neon-green/30', icon: <TrendingUp size={32} />, label: '买入' },
  'hold': { color: '#fbbf24', bgColor: 'bg-gold/10 border-gold/30', icon: <Minus size={32} />, label: '持有' },
  'reduce': { color: '#ff8800', bgColor: 'bg-gold/10 border-gold/30', icon: <TrendingDown size={32} />, label: '减持' },
  'sell': { color: '#ff3366', bgColor: 'bg-neon-red/10 border-neon-red/30', icon: <TrendingDown size={32} />, label: '卖出' },
  'strong_sell': { color: '#ff3366', bgColor: 'bg-neon-red/10 border-neon-red/30', icon: <TrendingDown size={32} />, label: '强烈卖出' },
}

const getSignalConfig = (signal?: string) => {
  if (!signal) return signalConfig['hold']
  const key = signal.toLowerCase().replace(/\s+/g, '_')
  return signalConfig[key] || signalConfig['hold']
}

const scoreColor = (score?: number) => {
  if (score === undefined) return 'text-[#8888aa]'
  if (score >= 0.8) return 'text-neon-green'
  if (score >= 0.5) return 'text-gold'
  if (score >= 0.3) return 'text-[#ff8800]'
  return 'text-neon-red'
}

const scoreBarColor = (score?: number) => {
  if (score === undefined) return '#8888aa'
  if (score >= 0.8) return '#00ff88'
  if (score >= 0.5) return '#fbbf24'
  if (score >= 0.3) return '#ff8800'
  return '#ff3366'
}

export default function ScoringPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeModel, setActiveModel] = useState<'dashboard' | 'analyzer'>('dashboard')
  const tr = useTranslation()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await macroApi.getDashboard()
      const d = extractApiData(res) as DashboardData
      setData(d)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(tr.scoring.load_error, { description: message })
    } finally {
      setLoading(false)
    }
  }, [tr])

  useEffect(() => {
    const init = async () => { await fetchData() }
    init()
  }, [fetchData])

  if (loading && !data) return <Loading text={tr.common.loading} />

  const overall = data?.overallSignal
  const tenDim = data?.tenDimensionScore
  const signal = getSignalConfig(overall?.direction || tenDim?.investmentSignal)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            <HolographicText as="span" color="mixed">{tr.scoring.title}</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{tr.scoring.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw size={14} /> {tr.common.refresh}
        </Button>
      </div>

      {/* Model Switcher */}
      <div className="flex gap-2">
        <Button
          variant={activeModel === 'dashboard' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => setActiveModel('dashboard')}
          glow={activeModel === 'dashboard'}
        >
          <Scale size={14} /> {tr.scoring.signal_engine}
        </Button>
        <Button
          variant={activeModel === 'analyzer' ? 'gold' : 'ghost'}
          size="sm"
          onClick={() => setActiveModel('analyzer')}
          glow={activeModel === 'analyzer'}
        >
          <Target size={14} /> {tr.scoring.ten_dimension}
        </Button>
      </div>

      {/* Investment Signal - Large Display */}
      <GlowCard
        color={signal.color === '#00ff88' ? 'green' : signal.color === '#ff3366' ? 'red' : 'gold'}
        className="text-center py-8"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="animate-pulse-glow" style={{ color: signal.color }}>
            {signal.icon}
          </div>
          <h2 className="text-4xl font-bold" style={{ color: signal.color, textShadow: `0 0 20px ${signal.color}40` }}>
            {tenDim?.investmentSignal ? getSignalConfig(tenDim.investmentSignal).label : signal.label}
          </h2>
          {tenDim?.totalScore !== undefined && (
            <p className="text-sm text-[#8888aa]">
              加权总分: <span className="font-mono text-[#e0e0ff]">{(tenDim.totalScore * 100).toFixed(1)}</span>
            </p>
          )}
          {tenDim?.actionAdvice && (
            <p className="text-sm text-[#e0e0ff] max-w-lg">{tenDim.actionAdvice}</p>
          )}
        </div>
      </GlowCard>

      {/* Dashboard Model */}
      {activeModel === 'dashboard' && (
        <div className="space-y-6">
          <GlowCard color="cyan">
            <h3 className="text-sm font-medium text-[#e0e0ff] mb-4 flex items-center gap-2">
              <Award size={16} className="text-cyan-glow" />
              {tr.scoring.signal_engine_score}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 glass-dark rounded-lg">
                <p className="text-xs text-[#8888aa] mb-1">{tr.scoring.overall_direction}</p>
                <p className={`text-lg font-bold ${overall?.direction === 'bullish' ? 'text-neon-green' : overall?.direction === 'bearish' ? 'text-neon-red' : 'text-gold'}`}>
                  {overall?.direction === 'bullish' ? tr.scoring.bullish : overall?.direction === 'bearish' ? tr.scoring.bearish : tr.scoring.neutral}
                </p>
              </div>
              <div className="text-center p-4 glass-dark rounded-lg">
                <p className="text-xs text-[#8888aa] mb-1">{tr.scoring.bullish_score}</p>
                <p className="text-lg font-mono font-bold text-neon-green">{overall?.bullishScore?.toFixed(1) ?? '--'}</p>
              </div>
              <div className="text-center p-4 glass-dark rounded-lg">
                <p className="text-xs text-[#8888aa] mb-1">{tr.scoring.bearish_score}</p>
                <p className="text-lg font-mono font-bold text-neon-red">{overall?.bearishScore?.toFixed(1) ?? '--'}</p>
              </div>
            </div>
          </GlowCard>
        </div>
      )}

      {/* Analyzer Model - Ten Dimensions */}
      {activeModel === 'analyzer' && (
        <div className="space-y-6">
          {[
            {
              key: 'shortTerm' as const,
              title: tr.scoring.short_term_trading,
              weight: 40,
              icon: <TrendingUp size={16} className="text-cyan-glow" />,
              color: 'cyan' as const,
            },
            {
              key: 'midTerm' as const,
              title: tr.scoring.mid_term_financial,
              weight: 40,
              icon: <Scale size={16} className="text-gold" />,
              color: 'gold' as const,
            },
            {
              key: 'longTerm' as const,
              title: tr.scoring.long_term_currency,
              weight: 20,
              icon: <Target size={16} className="text-electric-blue" />,
              color: 'blue' as const,
            },
          ].map((group) => {
            const groupData = tenDim?.[group.key]
            const dimensions = ensureArray<DimensionScore>(groupData?.dimensions)

            return (
              <GlowCard key={group.key} color={group.color}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-[#e0e0ff] flex items-center gap-2">
                    {group.icon}
                    {group.title}
                  </h3>
                  <Badge variant={group.color} size="md">
                    {tr.scoring.weight} {groupData?.weight !== undefined ? `${(groupData.weight * 100).toFixed(0)}%` : `${group.weight}%`}
                  </Badge>
                </div>

                {dimensions.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-[#8888aa]">{tr.common.no_data}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dimensions.map((dim, i) => {
                      const barColor = scoreBarColor(dim.score)
                      const scorePercent = dim.score !== undefined ? dim.score * 100 : 0
                      return (
                        <div key={i} className="glass-dark rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-[#e0e0ff]">{dim.name || `${tr.scoring.dimension} ${i + 1}`}</span>
                              {dim.weight !== undefined && (
                                <Badge variant="gray" size="sm">{tr.scoring.weight} {(dim.weight * 100).toFixed(0)}%</Badge>
                              )}
                            </div>
                            <span className={`text-sm font-mono font-bold ${scoreColor(dim.score)}`}>
                              {dim.score !== undefined ? dim.score.toFixed(2) : '--'}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden mb-2">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${scorePercent}%`, backgroundColor: barColor, boxShadow: `0 0 8px ${barColor}40` }}
                            />
                          </div>
                          {dim.description && (
                            <p className="text-xs text-[#8888aa] leading-relaxed">{dim.description}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </GlowCard>
            )
          })}

          {/* Total Score Summary */}
          <GlowCard color="gold" className="text-center py-6">
            <h3 className="text-sm font-medium text-[#e0e0ff] mb-4">{tr.scoring.score_summary}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-[#8888aa] mb-1">{tr.scoring.weighted_score}</p>
                <p className="text-2xl font-mono font-bold text-gold">
                  {tenDim?.totalScore !== undefined ? (tenDim.totalScore * 100).toFixed(1) : '--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8888aa] mb-1">{tr.scoring.investment_signal}</p>
                <p className="text-lg font-bold" style={{ color: signal.color }}>
                  {tenDim?.investmentSignal ? getSignalConfig(tenDim.investmentSignal).label : '--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#8888aa] mb-1">{tr.scoring.action_advice}</p>
                <p className="text-sm text-[#e0e0ff]">{tenDim?.actionAdvice ?? '--'}</p>
              </div>
            </div>
          </GlowCard>
        </div>
      )}
    </div>
  )
}
