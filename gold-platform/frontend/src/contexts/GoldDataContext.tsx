import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { goldApi, analysisApi } from '../lib/api'

interface GoldStats {
  internationalPrice: number
  domesticPrice: number
  internationalChange: number
  domesticChange: number
  high24h: number
  low24h: number
  openPrice: number
  volume: number
  updatedAt: string
}

interface KlineData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface AnalysisData {
  bullishFactors: Array<{ id: string; title: string; description: string; impact: string; category: string }>
  bearishFactors: Array<{ id: string; title: string; description: string; impact: string; category: string }>
  marketSummary: string
  institutionViews: Array<{ id: string; institution: string; view: string; targetPrice: number; date: string }>
  investmentAdvice: Array<{ id: string; level: string; title: string; description: string; action: string }>
}

interface GoldDataContextType {
  stats: GoldStats | null
  klineData: KlineData[]
  analysis: AnalysisData | null
  loading: boolean
  error: string | null
  refreshStats: () => Promise<void>
  refreshKline: (period?: string) => Promise<void>
  refreshAnalysis: () => Promise<void>
}

const GoldDataContext = createContext<GoldDataContextType | undefined>(undefined)

export function GoldDataProvider({ children }: { children: ReactNode }) {
  const [stats, setStats] = useState<GoldStats | null>(null)
  const [klineData, setKlineData] = useState<KlineData[]>([])
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isLoggedIn = !!localStorage.getItem('token')

  const refreshStats = useCallback(async () => {
    try {
      const res = await goldApi.getStats()
      const data = res.data?.data || res.data
      const domestic = data.domestic?.au99_99 || data.domestic || {}
      setStats({
        internationalPrice: data.current || 0,
        domesticPrice: domestic.price || 0,
        internationalChange: data.changePercent24h || data.weekChange || 0,
        domesticChange: domestic.changePercent || 0,
        high24h: data.high24h || 0,
        low24h: data.low24h || 0,
        openPrice: data.openPrice || 0,
        volume: data.volume24h || 0,
        updatedAt: data.timestamp ? new Date(data.timestamp).toISOString() : '',
      })
      setError(null)
    } catch (err) {
      setError('获取金价数据失败')
    }
  }, [])

  const refreshKline = useCallback(async (period?: string) => {
    try {
      const res = await goldApi.getKline({ period: period || '1d', count: 60 })
      const data = res.data?.data || res.data || {}
      const rawKlines = data.kline || data.klines || data || []
      const mapped = (Array.isArray(rawKlines) ? rawKlines : []).map((k: any) => {
        // 支持两种格式：对象格式 {date,open,high,low,close,volume} 和数组格式 [date,open,close,low,high,volume]
        if (Array.isArray(k)) {
          return {
            time: k[0] || '',
            open: k[1] || 0,
            close: k[2] || 0,
            low: k[3] || 0,
            high: k[4] || 0,
            volume: k[5] || 0,
          }
        }
        return {
          time: k.date || k.time || '',
          open: k.open || 0,
          high: k.high || 0,
          low: k.low || 0,
          close: k.close || 0,
          volume: k.volume || 0,
        }
      })
      setKlineData(mapped)
    } catch {
      // silently fail for kline
    }
  }, [])

  const refreshAnalysis = useCallback(async () => {
    try {
      const [bullishRes, bearishRes, summaryRes, viewsRes, adviceRes] = await Promise.allSettled([
        analysisApi.getBullishFactors(),
        analysisApi.getBearishFactors(),
        analysisApi.getMarketSummary(),
        analysisApi.getInstitutionViews(),
        analysisApi.getInvestmentAdvice(),
      ])

      const extractData = (res: any) => res.value?.data?.data || res.value?.data || {}

      const bullishData = bullishRes.status === 'fulfilled' ? extractData(bullishRes) : []
      const bearishData = bearishRes.status === 'fulfilled' ? extractData(bearishRes) : []
      const summaryData = summaryRes.status === 'fulfilled' ? extractData(summaryRes) : {}
      const viewsData = viewsRes.status === 'fulfilled' ? extractData(viewsRes) : []
      const adviceData = adviceRes.status === 'fulfilled' ? extractData(adviceRes) : {}

      setAnalysis({
        bullishFactors: Array.isArray(bullishData) ? bullishData : [],
        bearishFactors: Array.isArray(bearishData) ? bearishData : [],
        marketSummary: summaryData.priceOverview
          ? `国际金价$${summaryData.priceOverview.international?.price || '--'}/盎司，${summaryData.marketSentiment?.trend === 'bullish' ? '市场偏多' : summaryData.marketSentiment?.trend === 'bearish' ? '市场偏空' : '市场震荡'}。支撑位$${summaryData.keyLevels?.support || '--'}，阻力位$${summaryData.keyLevels?.resistance || '--'}。`
          : (summaryData.summary || ''),
        institutionViews: Array.isArray(viewsData) ? viewsData.map((v: any) => ({
          id: v.id,
          institution: v.institution_name || v.institution || '未知机构',
          view: v.rating === 'buy' ? '看涨' : v.rating === 'sell' ? '看跌' : v.rating === 'hold' ? '中性' : (v.view || '中性'),
          targetPrice: v.target_price || v.targetPrice,
          date: v.created_at || v.date || new Date().toISOString(),
        })) : [],
        investmentAdvice: adviceData.recommendations || adviceData.advice || [],
      })
    } catch {
      // silently fail for analysis
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      // K线和价格数据不需要认证，始终加载
      await refreshStats().catch(() => {})
      await refreshKline().catch(() => {})
      // 分析数据需要认证，仅登录时加载
      if (isLoggedIn) {
        await refreshAnalysis().catch(() => {})
      }
      setLoading(false)
    }
    init()

    const interval = setInterval(() => {
      refreshStats()
      refreshKline()
    }, 30000)

    return () => clearInterval(interval)
  }, [isLoggedIn, refreshStats, refreshKline, refreshAnalysis])

  return (
    <GoldDataContext.Provider value={{ stats, klineData, analysis, loading, error, refreshStats, refreshKline, refreshAnalysis }}>
      {children}
    </GoldDataContext.Provider>
  )
}

export function useGoldData() {
  const context = useContext(GoldDataContext)
  if (context === undefined) {
    throw new Error('useGoldData must be used within a GoldDataProvider')
  }
  return context
}
