import { useState, useEffect, useCallback } from 'react'
import {
  TrendingDown, DollarSign, Activity, BarChart3,
  RefreshCw, Shield, Zap, Target, ArrowUpRight, ArrowDownRight,
  Landmark, Flame, LineChart, Coins
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { macroApi } from '../lib/api'
import { ensureArray, extractApiData, translateText } from '../lib/utils'
import { toast } from 'sonner'
import { useTranslation, useLanguage } from '../contexts/LanguageContext'

interface DashboardData {
  summary?: {
    goldPrice?: number
    goldChange?: number
    dollarIndex?: number
    dollarChange?: number
    realRate?: number
    realRateChange?: number
    vix?: number
    vixChange?: number
    inflationExpectation?: number
    inflationChange?: number
    fedRate?: number
    fedRateChange?: number
  }
  factors?: {
    realRate?: { current?: number; ma20?: number; ma60?: number; trend?: string }
    dollar?: { current?: number; momentum20d?: number; trend?: string }
    inflation?: { breakeven?: number; cpi?: number; pce?: number }
    fedAssets?: { current?: number; change?: number }
    vix?: { current?: number; trend?: string }
  }
  goldHistory?: Array<{ date: string; price: number; ma50?: number; ma200?: number }>
  realRateHistory?: Array<{ date: string; value: number }>
  dollarHistory?: Array<{ date: string; value: number }>
  technicals?: {
    ma50?: number
    ma200?: number
    rsi14?: number
    support?: number
    resistance?: number
    crossStatus?: string
  }
  goldSilverRatio?: number
  gdxEtf?: { price?: number; change?: number }
  yieldCurve?: { slope?: number; trend?: string }
  volatility?: { current?: number; avg30d?: number }
  cot?: { netLong?: number; change?: number }
  gldEtf?: { flow?: number; holdings?: number }
  centralBankBuying?: { tonnes?: number; trend?: string }
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-dark p-3 text-xs">
        <p className="text-[#8888aa] mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color }} className="font-mono font-bold">
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

export default function MacroDashboard() {
  const { language } = useLanguage()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const tr = useTranslation()

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await macroApi.getDashboard(language)
      const d = extractApiData(res) as DashboardData
      setData(d)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(tr.macro.load_error, { description: message })
    } finally {
      setLoading(false)
    }
  }, [tr])

  useEffect(() => {
    const init = async () => { await fetchData() }
    init()
  }, [fetchData])

  if (loading && !data) return <Loading text={tr.common.loading} />

  const s = data?.summary
  const f = data?.factors
  const tech = data?.technicals

  const summaryCards = [
    { label: tr.macro.gold_price_xau, value: s?.goldPrice ? `$${s.goldPrice.toFixed(2)}` : '--', change: s?.goldChange ?? 0, icon: Coins, color: 'gold' as const },
    { label: tr.macro.dollar_index_dxy, value: s?.dollarIndex?.toFixed(2) ?? '--', change: s?.dollarChange ?? 0, icon: DollarSign, color: 'blue' as const },
    { label: tr.macro.real_rate, value: s?.realRate?.toFixed(2) ?? '--', change: s?.realRateChange ?? 0, icon: TrendingDown, color: 'cyan' as const },
    { label: tr.macro.vix_index, value: s?.vix?.toFixed(2) ?? '--', change: s?.vixChange ?? 0, icon: Flame, color: 'red' as const },
    { label: tr.macro.inflation_expectation, value: s?.inflationExpectation?.toFixed(2) ?? '--', change: s?.inflationChange ?? 0, icon: Target, color: 'green' as const },
    { label: tr.macro.fed_rate, value: s?.fedRate?.toFixed(2) ?? '--', change: s?.fedRateChange ?? 0, icon: Landmark, color: 'gold' as const },
  ]

  const goldHistory = ensureArray(data?.goldHistory)
  const realRateHistory = ensureArray(data?.realRateHistory)
  const dollarHistory = ensureArray(data?.dollarHistory)

  const trendIcon = (trend?: string) => {
    if (trend === 'up' || trend === 'bullish' || trend === 'rising' || trend === 'increasing') return <ArrowUpRight size={14} className="text-neon-green" />
    if (trend === 'down' || trend === 'bearish' || trend === 'declining' || trend === 'decreasing') return <ArrowDownRight size={14} className="text-neon-red" />
    return <Activity size={14} className="text-[#8888aa]" />
  }

  const trendLabel = (trend?: string) => {
    if (trend === 'up' || trend === 'bullish' || trend === 'rising' || trend === 'increasing') return tr.macro.up
    if (trend === 'down' || trend === 'bearish' || trend === 'declining' || trend === 'decreasing') return tr.macro.down
    return tr.macro.sideways
  }

  const trendColor = (trend?: string) => {
    if (trend === 'up' || trend === 'bullish' || trend === 'rising' || trend === 'increasing') return 'text-neon-green'
    if (trend === 'down' || trend === 'bearish' || trend === 'declining' || trend === 'decreasing') return 'text-neon-red'
    return 'text-[#8888aa]'
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            <HolographicText as="span" color="cyan">{tr.macro.title_part1}</HolographicText>{tr.macro.title_part2}
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{tr.macro.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchData}>
          <RefreshCw size={14} /> {tr.common.refresh}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map((card) => (
          <GlowCard key={card.label} color={card.color} className="relative overflow-hidden min-w-[120px]">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[10px] text-[#8888aa] mb-1 truncate">{card.label}</p>
                <p className={`text-lg font-mono font-bold ${card.change >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                  {card.value}
                </p>
                {card.change !== 0 && (
                  <p className={`text-xs font-mono ${card.change >= 0 ? 'text-neon-green' : 'text-neon-red'}`}>
                    {card.change >= 0 ? '+' : ''}{card.change.toFixed(2)}%
                  </p>
                )}
              </div>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                card.color === 'gold' ? 'bg-gold/10 text-gold' :
                card.color === 'blue' ? 'bg-electric-blue/10 text-electric-blue' :
                card.color === 'cyan' ? 'bg-cyan-glow/10 text-cyan-glow' :
                card.color === 'red' ? 'bg-neon-red/10 text-neon-red' :
                'bg-neon-green/10 text-neon-green'
              }`}>
                <card.icon size={16} />
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      {/* Core Factors Panel */}
      <div>
        <h2 className="text-lg font-semibold text-[#e0e0ff] mb-3">
          <Shield size={18} className="inline mr-1.5 text-cyan-glow" />
          {tr.macro.core_factor_panel}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Real Rate */}
          <GlowCard color="cyan" className="min-w-0">
            <p className="text-xs text-[#8888aa] mb-2">{tr.macro.real_rate}</p>
            <p className="text-xl font-mono font-bold text-cyan-glow mb-2">
              {f?.realRate?.current?.toFixed(2) ?? '--'}%
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-[#8888aa]">MA20</span><span className="text-[#e0e0ff]">{f?.realRate?.ma20?.toFixed(2) ?? '--'}</span></div>
              <div className="flex justify-between"><span className="text-[#8888aa]">MA60</span><span className="text-[#e0e0ff]">{f?.realRate?.ma60?.toFixed(2) ?? '--'}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-[#8888aa]">{tr.macro.trend}</span>
                <span className={`flex items-center gap-1 ${trendColor(f?.realRate?.trend)}`}>
                  {trendIcon(f?.realRate?.trend)} {trendLabel(f?.realRate?.trend)}
                </span>
              </div>
            </div>
          </GlowCard>

          {/* Dollar */}
          <GlowCard color="blue" className="min-w-0">
            <p className="text-xs text-[#8888aa] mb-2">{tr.macro.dollar_index}</p>
            <p className="text-xl font-mono font-bold text-electric-blue mb-2">
              {f?.dollar?.current?.toFixed(2) ?? '--'}
            </p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-[#8888aa]">{tr.macro.momentum_20d}</span><span className="text-[#e0e0ff]">{f?.dollar?.momentum20d?.toFixed(2) ?? '--'}</span></div>
              <div className="flex justify-between items-center">
                <span className="text-[#8888aa]">{tr.macro.trend}</span>
                <span className={`flex items-center gap-1 ${trendColor(f?.dollar?.trend)}`}>
                  {trendIcon(f?.dollar?.trend)} {trendLabel(f?.dollar?.trend)}
                </span>
              </div>
            </div>
          </GlowCard>

          {/* Inflation */}
          <GlowCard color="gold" className="min-w-0">
            <p className="text-xs text-[#8888aa] mb-2">{tr.macro.inflation_indicator}</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#8888aa]">{tr.macro.breakeven}</span><span className="text-gold font-mono">{f?.inflation?.breakeven?.toFixed(2) ?? '--'}%</span></div>
              <div className="flex justify-between"><span className="text-[#8888aa]">{tr.macro.cpi}</span><span className="text-gold font-mono">{f?.inflation?.cpi?.toFixed(2) ?? '--'}%</span></div>
              <div className="flex justify-between"><span className="text-[#8888aa]">{tr.macro.pce}</span><span className="text-gold font-mono">{f?.inflation?.pce?.toFixed(2) ?? '--'}%</span></div>
            </div>
          </GlowCard>

          {/* Fed Assets */}
          <GlowCard color="gold" className="min-w-0">
            <p className="text-xs text-[#8888aa] mb-2">{tr.macro.fed_assets}</p>
            <p className="text-xl font-mono font-bold text-gold mb-2">
              {f?.fedAssets?.current ? `$${(f.fedAssets.current / 1e3).toFixed(0)}B` : '--'}
            </p>
            <div className="text-xs">
              <div className="flex justify-between"><span className="text-[#8888aa]">{tr.macro.change}</span><span className={f?.fedAssets?.change && f.fedAssets.change < 0 ? 'text-neon-red' : 'text-neon-green'}>{f?.fedAssets?.change ? `${(f.fedAssets.change / 1e3).toFixed(0)}B` : '--'}</span></div>
            </div>
          </GlowCard>

          {/* VIX */}
          <GlowCard color="red" className="min-w-0">
            <p className="text-xs text-[#8888aa] mb-2">{tr.macro.vix_index}</p>
            <p className="text-xl font-mono font-bold text-neon-red mb-2">
              {f?.vix?.current?.toFixed(2) ?? '--'}
            </p>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#8888aa]">{tr.macro.trend}</span>
              <span className={`flex items-center gap-1 ${trendColor(f?.vix?.trend)}`}>
                {trendIcon(f?.vix?.trend)} {trendLabel(f?.vix?.trend)}
              </span>
            </div>
          </GlowCard>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gold Price Chart with MA */}
        <div className="lg:col-span-2 glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#e0e0ff]">
              <LineChart size={16} className="inline mr-1.5 text-gold" />
              {tr.macro.gold_trend_ma}
            </h3>
            <Badge variant="gold">XAU/USD</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={goldHistory}>
                <defs>
                  <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#8888aa' }} />
                <Area type="monotone" dataKey="price" stroke="#fbbf24" strokeWidth={2} fill="url(#goldGradient)" name={tr.macro.gold_price} />
                <Area type="monotone" dataKey="ma50" stroke="#00f0ff" strokeWidth={1.5} strokeDasharray="4 2" fill="none" name={tr.macro.ma50} />
                <Area type="monotone" dataKey="ma200" stroke="#ff3366" strokeWidth={1.5} strokeDasharray="6 3" fill="none" name={tr.macro.ma200} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real Rate Chart */}
        <div className="glass p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-[#e0e0ff]">
              <TrendingDown size={16} className="inline mr-1.5 text-cyan-glow" />
              {tr.macro.real_rate_trend}
            </h3>
            <Badge variant="cyan">Real Rate</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={realRateHistory}>
                <defs>
                  <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} />
                <YAxis tick={{ fill: '#8888aa', fontSize: 10 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="value" stroke="#00f0ff" strokeWidth={2} fill="url(#rateGradient)" name={tr.macro.real_rate} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Dollar Chart */}
      <div className="glass p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#e0e0ff]">
            <DollarSign size={16} className="inline mr-1.5 text-electric-blue" />
            {tr.macro.dollar_trend}
          </h3>
          <Badge variant="blue">DXY</Badge>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dollarHistory}>
              <defs>
                <linearGradient id="dollarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0088ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0088ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
              <XAxis dataKey="date" tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} />
              <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} axisLine={{ stroke: 'rgba(0,240,255,0.1)' }} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="value" stroke="#0088ff" strokeWidth={2} fill="url(#dollarGradient)" name={tr.macro.dollar_index} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Technicals + Extended Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Technical Indicators */}
        <GlowCard color="cyan">
          <h3 className="text-sm font-medium text-[#e0e0ff] mb-4">
            <Zap size={16} className="inline mr-1.5 text-cyan-glow" />
            {tr.macro.tech_indicator_panel}
          </h3>
          <div className="space-y-3">
            {[
              { label: 'MA50', value: data?.technicals?.ma50?.toFixed(2) ?? '--', color: 'text-cyan-glow' },
              { label: 'MA200', value: data?.technicals?.ma200?.toFixed(2) ?? '--', color: 'text-neon-red' },
              { label: 'RSI14', value: data?.technicals?.rsi14?.toFixed(2) ?? '--', color: data?.technicals?.rsi14 && data.technicals.rsi14 > 70 ? 'text-neon-red' : data?.technicals?.rsi14 && data.technicals.rsi14 < 30 ? 'text-neon-green' : 'text-cyan-glow' },
              { label: tr.macro.support, value: data?.technicals?.support?.toFixed(2) ?? '--', color: 'text-neon-green' },
              { label: tr.macro.resistance, value: data?.technicals?.resistance?.toFixed(2) ?? '--', color: 'text-neon-red' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-[rgba(0,240,255,0.06)] last:border-0">
                <span className="text-xs text-[#8888aa]">{item.label}</span>
                <span className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-[#8888aa]">{tr.macro.golden_cross}/{tr.macro.death_cross}</span>
              <Badge variant={data?.technicals?.crossStatus === 'golden_cross' ? 'green' : data?.technicals?.crossStatus === 'death_cross' ? 'red' : 'gray'}>
                {data?.technicals?.crossStatus === 'golden_cross' ? tr.macro.golden_cross : data?.technicals?.crossStatus === 'death_cross' ? tr.macro.death_cross : tr.macro.no_signal}
              </Badge>
            </div>
          </div>
        </GlowCard>

        {/* Extended Data */}
        <GlowCard color="gold">
          <h3 className="text-sm font-medium text-[#e0e0ff] mb-4">
            <BarChart3 size={16} className="inline mr-1.5 text-gold" />
            {tr.macro.extended_market}
          </h3>
          <div className="space-y-3">
            {[
              { label: tr.macro.gold_silver_ratio, value: data?.goldSilverRatio?.toFixed(2) ?? '--', color: 'text-gold' },
              { label: tr.macro.gdx_etf, value: data?.gdxEtf?.price ? `$${data.gdxEtf.price.toFixed(2)}` : '--', sub: data?.gdxEtf?.change?.toFixed(2) ? `${data.gdxEtf.change >= 0 ? '+' : ''}${data.gdxEtf.change.toFixed(2)}%` : undefined, color: 'text-gold' },
              { label: tr.macro.yield_curve_slope, value: data?.yieldCurve?.slope?.toFixed(2) ?? '--', color: 'text-electric-blue' },
              { label: tr.macro.yield_curve_trend, value: data?.yieldCurve?.trend ? translateText(data.yieldCurve.trend, tr) : '--', color: 'text-electric-blue' },
              { label: tr.macro.volatility_ratio, value: data?.volatility ? `${data.volatility.current?.toFixed(2) ?? '--'} / ${data.volatility.avg30d?.toFixed(2) ?? '--'}` : '--', color: 'text-neon-red' },
              { label: tr.macro.cot_net_long, value: data?.cot?.netLong?.toLocaleString() ?? '--', sub: data?.cot?.change?.toFixed(0) ? `${data.cot.change >= 0 ? '+' : ''}${data.cot.change.toFixed(0)}` : undefined, color: 'text-cyan-glow' },
              { label: tr.macro.gld_inflow, value: data?.gldEtf?.flow?.toFixed(2) ?? '--', color: 'text-neon-green' },
              { label: tr.macro.gld_holding, value: data?.gldEtf?.holdings ? `${data.gldEtf.holdings.toFixed(0)}t` : '--', color: 'text-neon-green' },
              { label: tr.macro.cb_gold_buy, value: data?.centralBankBuying?.tonnes ? `${data.centralBankBuying.tonnes.toFixed(0)}t` : '--', color: 'text-gold' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-[rgba(0,240,255,0.06)] last:border-0">
                <span className="text-xs text-[#8888aa]">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-mono font-bold ${item.color}`}>{item.value}</span>
                  {item.sub && <span className="text-xs text-[#8888aa]">({item.sub})</span>}
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </div>
    </div>
  )
}
