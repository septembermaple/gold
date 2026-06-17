import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Gauge, Activity } from 'lucide-react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, ResponsiveContainer, Tooltip
} from 'recharts'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { macroApi } from '../lib/api'
import { ensureArray, extractApiData } from '../lib/utils'
import { toast } from 'sonner'
import { useTranslation } from '../contexts/LanguageContext'

interface FactorScore {
  name?: string
  weight?: number
  score?: number
  label?: string
}

interface RadarItem {
  dimension?: string
  score?: number
  fullMark?: number
}

interface DashboardData {
  sentiment?: {
    score?: number
    label?: string
    factors?: FactorScore[]
  }
  radar?: RadarItem[]
}

const getGaugeColor = (score: number) => {
  if (score >= 70) return '#00ff88'
  if (score >= 50) return '#fbbf24'
  if (score >= 30) return '#ff8800'
  return '#ff3366'
}

const getGaugeLabel = (score: number) => {
  if (score >= 80) return '极度贪婪'
  if (score >= 60) return '贪婪'
  if (score >= 40) return '中性'
  if (score >= 20) return '恐惧'
  return '极度恐惧'
}

function GaugeChart({ score }: { score: number }) {
  const clampedScore = Math.min(Math.max(score, 0), 100)
  const angle = (clampedScore / 100) * 180 - 90
  const color = getGaugeColor(clampedScore)

  const ticks = [0, 20, 40, 60, 80, 100]

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-64 h-auto">
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="rgba(0,240,255,0.1)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Colored arc segments */}
        <path
          d="M 20 100 A 80 80 0 0 1 60 32"
          fill="none"
          stroke="#ff3366"
          strokeWidth="12"
          strokeLinecap="round"
          opacity={0.6}
        />
        <path
          d="M 60 32 A 80 80 0 0 1 100 20"
          fill="none"
          stroke="#ff8800"
          strokeWidth="12"
          strokeLinecap="round"
          opacity={0.6}
        />
        <path
          d="M 100 20 A 80 80 0 0 1 140 32"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="12"
          strokeLinecap="round"
          opacity={0.6}
        />
        <path
          d="M 140 32 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#00ff88"
          strokeWidth="12"
          strokeLinecap="round"
          opacity={0.6}
        />
        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2={100 + 65 * Math.cos((angle * Math.PI) / 180)}
          y2={100 + 65 * Math.sin((angle * Math.PI) / 180)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
        {/* Center circle */}
        <circle cx="100" cy="100" r="6" fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
        {/* Tick labels */}
        {ticks.map((tick) => {
          const tickAngle = (tick / 100) * 180 - 90
          const x = 100 + 92 * Math.cos((tickAngle * Math.PI) / 180)
          const y = 100 + 92 * Math.sin((tickAngle * Math.PI) / 180)
          return (
            <text key={tick} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#8888aa" fontSize="9">
              {tick}
            </text>
          )
        })}
      </svg>
      <div className="text-center -mt-2">
        <p className="text-4xl font-mono font-bold" style={{ color, textShadow: `0 0 20px ${color}40` }}>
          {clampedScore.toFixed(0)}
        </p>
        <p className="text-sm text-[#8888aa] mt-1">{getGaugeLabel(clampedScore)}</p>
      </div>
    </div>
  )
}

export default function SentimentPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const tr = useTranslation()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await macroApi.getDashboard()
      const d = extractApiData(res) as DashboardData
      setData(d)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(tr.sentiment.load_error, { description: message })
    } finally {
      setLoading(false)
    }
  }, [tr])

  useEffect(() => {
    const init = async () => { await fetchData() }
    init()
  }, [fetchData])

  if (loading && !data) return <Loading text={tr.common.loading} />

  const sentiment = data?.sentiment
  const factors = ensureArray<FactorScore>(sentiment?.factors)
  const radarData = ensureArray<RadarItem>(data?.radar)

  const defaultRadarData = [
    { dimension: '实际利率', score: 50, fullMark: 100 },
    { dimension: '美元强弱', score: 50, fullMark: 100 },
    { dimension: '通胀预期', score: 50, fullMark: 100 },
    { dimension: '流动性', score: 50, fullMark: 100 },
    { dimension: '避险需求', score: 50, fullMark: 100 },
    { dimension: '资金流入', score: 50, fullMark: 100 },
  ]

  const chartRadarData = radarData.length > 0
    ? radarData.map((r) => ({ dimension: r.dimension ?? '', score: r.score ?? 0, fullMark: r.fullMark ?? 100 }))
    : defaultRadarData

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            <HolographicText as="span" color="gold">{tr.sentiment.title_part1}</HolographicText>{tr.sentiment.title_part2}
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{tr.sentiment.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw size={14} /> {tr.common.refresh}
        </Button>
      </div>

      {/* Gauge + Factor Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gauge */}
        <GlowCard
          color={sentiment?.score && sentiment.score >= 50 ? 'green' : 'red'}
          className="flex flex-col items-center justify-center py-6"
        >
          <h3 className="text-sm font-medium text-[#e0e0ff] mb-4 flex items-center gap-2">
            <Gauge size={16} className="text-cyan-glow" />
            {tr.sentiment.gauge_title}
          </h3>
          <GaugeChart score={sentiment?.score ?? 50} />
          {sentiment?.label && (
            <p className="text-xs text-[#8888aa] mt-3">{tr.sentiment.label}: <span className="text-[#e0e0ff]">{sentiment.label}</span></p>
          )}
        </GlowCard>

        {/* Factor Scores */}
        <GlowCard color="cyan">
          <h3 className="text-sm font-medium text-[#e0e0ff] mb-4 flex items-center gap-2">
            <Activity size={16} className="text-cyan-glow" />
            {tr.sentiment.factor_scores}
          </h3>
          <div className="space-y-4">
            {factors.length === 0 ? (
              <div className="space-y-4">
                {['VIX', '实际利率', '美元', '技术面', 'COT', 'GLD ETF'].map((name) => (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#8888aa]">{name}</span>
                      <span className="text-xs text-[#8888aa]">--</span>
                    </div>
                    <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-glow/30 rounded-full" style={{ width: '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              factors.map((factor, i) => {
                const score = factor.score ?? 0
                const color = score >= 70 ? '#00ff88' : score >= 40 ? '#fbbf24' : '#ff3366'
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-[#8888aa]">
                        {factor.name || `因子 ${i + 1}`}
                        {factor.weight !== undefined && (
                          <span className="ml-1 text-[#8888aa]/60">(权重: {(factor.weight * 100).toFixed(0)}%)</span>
                        )}
                      </span>
                      <span className="text-xs font-mono font-bold" style={{ color }}>
                        {score.toFixed(0)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-dark-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${score}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </GlowCard>
      </div>

      {/* Radar Chart */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#e0e0ff]">
            <Activity size={16} className="inline mr-1.5 text-gold" />
            {tr.sentiment.radar_chart}
          </h3>
          <Badge variant="gold">Radar</Badge>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartRadarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="rgba(0,240,255,0.1)" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: '#8888aa', fontSize: 12 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: '#8888aa', fontSize: 10 }}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(13, 13, 43, 0.9)',
                  border: '1px solid rgba(0, 240, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#e0e0ff',
                  fontSize: '12px',
                }}
              />
              <Radar
                name={tr.sentiment.sentiment_score}
                dataKey="score"
                stroke="#00f0ff"
                fill="#00f0ff"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
