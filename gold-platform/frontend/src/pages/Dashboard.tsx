import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Brain, Activity, DollarSign, BarChart3, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { useGoldData } from '../contexts/GoldDataContext'
import { formatPrice, formatPercent, getPriceColor } from '../lib/utils'
import { useTranslation, useLanguage } from '../contexts/LanguageContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const { stats, klineData, loading, refreshStats, refreshKline } = useGoldData()
  const [activePeriod, setActivePeriod] = useState('1d')
  const [klineLoading, setKlineLoading] = useState(false)
  const t = useTranslation()
  const { language } = useLanguage()

  const PERIOD_OPTIONS = [
    { key: '1h', label: t.dashboard.hour_1 },
    { key: '4h', label: t.dashboard.hour_4 },
    { key: '1d', label: t.dashboard.day_k },
    { key: '1w', label: t.dashboard.week_k },
  ]

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; payload?: { time?: string } }>; label?: string | number }) => {
    if (active && payload && payload.length) {
      const timeLabel = payload[0]?.payload?.time || (typeof label === 'number' ? new Date(label).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US') : label)
      return (
        <div className="glass-dark p-3 text-xs">
          <p className="text-[#8888aa] mb-1">{timeLabel}</p>
          {payload.map((entry, i) => (
            <p key={i} className="font-mono font-bold" style={{ color: entry.name === 'volume' ? '#fbbf24' : '#00f0ff' }}>
              {entry.name === 'volume' ? `${t.dashboard.volume}: ${entry.value?.toLocaleString()}` : `${t.dashboard.price}: $${formatPrice(entry.value)}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const handlePeriodChange = async (period: string) => {
    setActivePeriod(period)
    setKlineLoading(true)
    await refreshKline(period)
    setKlineLoading(false)
  }

  if (loading && !stats) {
    return <Loading text={t.common.loading} />
  }

  const formatKlineTime = (time: string, period: string) => {
    if (!time) return ''
    if (period === '1h' || period === '4h') {
      const d = new Date(time.replace(' ', 'T'))
      if (isNaN(d.getTime())) return time.slice(5, 16)
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    if (period === '1w') {
      return time.slice(5, 10)
    }
    return time.slice(5, 10)
  }

  const formatTickTime = (ts: number, period: string) => {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return ''
    if (period === '1h' || period === '4h') {
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }
    return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
  }

  const chartData = klineData.length > 0
    ? klineData.map((k) => {
        let ts: number
        if (k.time && k.time.includes(' ')) {
          ts = new Date(k.time.replace(' ', 'T')).getTime()
        } else if (k.time) {
          ts = new Date(k.time + 'T00:00:00').getTime()
        } else {
          ts = Date.now()
        }
        return {
          ts,
          time: formatKlineTime(k.time, activePeriod),
          price: k.close,
          open: k.open,
          high: k.high,
          low: k.low,
          volume: k.volume,
        }
      })
    : []

  // 根据数据范围和周期，生成X轴刻度值（时间戳数组）
  const generateTicks = (data: { ts: number }[], period: string): number[] => {
    if (data.length === 0) return []
    const minTs = data[0].ts
    const maxTs = data[data.length - 1].ts
    const stepMap: Record<string, number> = {
      '1h': 3600 * 1000,
      '4h': 4 * 3600 * 1000,
      '1d': 24 * 3600 * 1000,
      '1w': 7 * 24 * 3600 * 1000,
    }
    const step = stepMap[period] || 24 * 3600 * 1000
    const ticks: number[] = []
    // 从最小时间戳向下对齐到step整数倍
    const aligned = Math.floor(minTs / step) * step
    for (let t = aligned; t <= maxTs + step; t += step) {
      if (t >= minTs) ticks.push(t)
    }
    return ticks
  }
  const xTicks = generateTicks(chartData, activePeriod)

  const statCards = [
    {
      label: t.dashboard.international_price,
      value: stats?.internationalPrice ? `$${formatPrice(stats.internationalPrice)}` : '--',
      change: stats?.internationalChange || 0,
      icon: DollarSign,
      color: 'cyan' as const,
    },
    {
      label: t.dashboard.domestic_price,
      value: stats?.domesticPrice ? `¥${formatPrice(stats.domesticPrice)}` : '--',
      change: stats?.domesticChange || 0,
      icon: BarChart3,
      color: 'gold' as const,
    },
    {
      label: t.dashboard.high24h,
      value: stats?.high24h ? `$${formatPrice(stats.high24h)}` : '--',
      change: 0,
      icon: TrendingUp,
      color: 'green' as const,
    },
    {
      label: t.dashboard.low24h,
      value: stats?.low24h ? `$${formatPrice(stats.low24h)}` : '--',
      change: 0,
      icon: TrendingDown,
      color: 'red' as const,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            {t.dashboard.market}<HolographicText color="cyan">{t.dashboard.dashboard}</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{t.dashboard.market_overview}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { refreshStats(); refreshKline(activePeriod) }}>
          <RefreshCw size={14} /> {t.common.refresh}
        </Button>
      </div>

      {/* Price Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <GlowCard key={card.label} color={card.color} className="relative overflow-hidden min-w-0 min-h-[110px]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-[#8888aa] mb-1">{card.label}</p>
                <p className={`text-xl font-mono font-bold ${getPriceColor(card.change)}`}>
                  {card.value}
                </p>
                {card.change !== 0 && (
                  <p className={`text-sm font-mono mt-1 ${getPriceColor(card.change)}`}>
                    {formatPercent(card.change)}
                  </p>
                )}
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                card.color === 'cyan' ? 'bg-cyan-glow/10 text-cyan-glow' :
                card.color === 'gold' ? 'bg-gold/10 text-gold' :
                card.color === 'green' ? 'bg-neon-green/10 text-neon-green' :
                'bg-neon-red/10 text-neon-red'
              }`}>
                <card.icon size={20} />
              </div>
            </div>
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${
              card.color === 'cyan' ? 'bg-gradient-to-r from-transparent via-cyan-glow/50 to-transparent' :
              card.color === 'gold' ? 'bg-gradient-to-r from-transparent via-gold/50 to-transparent' :
              card.color === 'green' ? 'bg-gradient-to-r from-transparent via-neon-green/50 to-transparent' :
              'bg-gradient-to-r from-transparent via-neon-red/50 to-transparent'
            }`} />
          </GlowCard>
        ))}
      </div>

      {/* Market Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: t.dashboard.open_price, value: stats?.openPrice ? `$${formatPrice(stats.openPrice)}` : '--' },
          { label: t.dashboard.volume24h, value: stats?.volume ? stats.volume.toLocaleString() : '--' },
          { label: t.dashboard.data_update, value: stats?.updatedAt ? new Date(stats.updatedAt).toLocaleTimeString(language === 'zh-CN' ? 'zh-CN' : 'en-US') : '--' },
          { label: t.dashboard.market_status, value: t.dashboard.trading },
        ].map((item) => (
          <div key={item.label} className="glass-dark p-4 text-center min-w-0 min-h-[88px]">
            <p className="text-xs text-[#8888aa] mb-1">{item.label}</p>
            <p className="text-sm font-mono text-[#e0e0ff]">{item.value}</p>
          </div>
        ))}
      </div>

      {/* AI Analysis Button */}
      <GlowCard color="cyan" className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-glow/10 flex items-center justify-center animate-glow-pulse">
            <Brain size={24} className="text-cyan-glow" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#e0e0ff]">{t.dashboard.ai_analysis}</h3>
            <p className="text-sm text-[#8888aa]">{t.dashboard.ai_analysis_desc}</p>
          </div>
        </div>
        <Button variant="primary" glow onClick={() => navigate('/analysis')}>
          {t.dashboard.start_analysis} <TrendingUp size={16} />
        </Button>
      </GlowCard>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Price Chart */}
        <div className="xl:col-span-2 glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#e0e0ff]">
              <Activity size={16} className="inline mr-1.5 text-cyan-glow" />
              {t.dashboard.price_trend}
            </h3>
            <div className="flex items-center gap-2">
              {/* K线周期切换 */}
              <div className="flex gap-1">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => handlePeriodChange(opt.key)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-all ${
                      activePeriod === opt.key
                        ? 'bg-cyan-glow/20 text-cyan-glow border border-cyan-glow/30'
                        : 'text-[#8888aa] hover:text-[#e0e0ff] border border-transparent'
                    }`}
                  >
                    {t.dashboard[opt.label as keyof typeof t.dashboard] || opt.label}
                  </button>
                ))}
              </div>
              <Badge variant="cyan">XAU/USD</Badge>
            </div>
          </div>
          <div className="h-80 relative">
            {klineLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-dark-900/50 z-10 rounded-lg">
                <div className="text-cyan-glow text-sm animate-pulse">{t.common.loading}</div>
              </div>
            )}
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    ticks={xTicks}
                    tickFormatter={(ts: number) => formatTickTime(ts, activePeriod)}
                    tick={{ fill: '#8888aa', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(0,240,255,0.1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#8888aa', fontSize: 11 }}
                    axisLine={{ stroke: 'rgba(0,240,255,0.1)' }}
                    tickLine={false}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#00f0ff"
                    strokeWidth={2}
                    fill="url(#priceGradient)"
                    name={t.dashboard.price}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[#8888aa] text-sm">
                {t.common.no_data}
              </div>
            )}
          </div>
        </div>

        {/* Volume Chart */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#e0e0ff]">
              <BarChart3 size={16} className="inline mr-1.5 text-gold" />
              {t.dashboard.volume}
            </h3>
            <Badge variant="gold">Volume</Badge>
          </div>
          <div className="h-80">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    ticks={xTicks}
                    tickFormatter={(ts: number) => formatTickTime(ts, activePeriod)}
                    tick={{ fill: '#8888aa', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(0,240,255,0.1)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#8888aa', fontSize: 10 }}
                    axisLine={{ stroke: 'rgba(0,240,255,0.1)' }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="volume" fill="#fbbf24" opacity={0.7} radius={[2, 2, 0, 0]} name={t.dashboard.volume} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[#8888aa] text-sm">
                {t.common.no_data}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
