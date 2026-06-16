import { useState, useEffect, useCallback } from 'react'
import { CandlestickChart, Play, RefreshCw, AlertTriangle, CheckCircle, Database, Calendar, Clock } from 'lucide-react'
import GlowCard from '../../components/ui/GlowCard'
import HolographicText from '../../components/ui/HolographicText'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { adminApi } from '../../lib/api'
import { extractApiData } from '../../lib/utils'
import { toast } from 'sonner'

interface KlinePeriodStatus {
  period: string
  count: number
  from: string | null
  to: string | null
}

export default function AdminKline() {
  const [statuses, setStatuses] = useState<KlinePeriodStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [period, setPeriod] = useState('1d')
  const [loadProgress, setLoadProgress] = useState<string | null>(null)
  const [loadResult, setLoadResult] = useState<{ count: number; period: string } | null>(null)

  // 确认对话框状态
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    startDate: string
    endDate: string
    period: string
    existingRange: string
  }>({ open: false, startDate: '', endDate: '', period: '', existingRange: '' })

  const periods = [
    { value: '1h', label: '1小时' },
    { value: '4h', label: '4小时' },
    { value: '1d', label: '1天' },
    { value: '1w', label: '1周' },
  ]

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getKlineStatus()
      const data = extractApiData(res)
      const statusList = data.statuses || data.periods || data || []
      setStatuses(Array.isArray(statusList) ? statusList : [])
    } catch {
      toast.error('获取K线数据状态失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleLoad = async () => {
    if (!startDate) {
      toast.error('请输入起始日期')
      return
    }

    setLoadResult(null)
    setLoadProgress('正在检查数据...')

    try {
      // 先尝试普通加载
      const res = await adminApi.loadKlineData(startDate, period)
      const data = extractApiData(res)

      // 如果后端返回需要确认覆盖（conflict字段）
      if (data.conflict) {
        setLoadProgress(null)
        const existingFrom = data.existingFrom || ''
        const existingTo = data.existingTo || ''
        setConfirmModal({
          open: true,
          startDate,
          endDate,
          period,
          existingRange: `${existingFrom} 到 ${existingTo}`,
        })
        return
      }

      // 加载成功
      setLoadProgress(null)
      const loadedCount = data.loaded || data.count || data.inserted || 0
      setLoadResult({ count: loadedCount, period })
      toast.success(`成功加载 ${loadedCount} 条K线数据`)
      loadStatus()
    } catch (err: any) {
      setLoadProgress(null)
      // 如果后端返回409表示数据冲突，弹出确认对话框
      if (err.response?.status === 409) {
        const errData = err.response.data?.data || err.response.data || {}
        const existingFrom = errData.existingFrom || ''
        const existingTo = errData.existingTo || ''
        setConfirmModal({
          open: true,
          startDate,
          endDate,
          period,
          existingRange: `${existingFrom} 到 ${existingTo}`,
        })
      } else {
        toast.error(err.response?.data?.message || err.response?.data?.error || '加载数据失败')
      }
    }
  }

  const handleForceLoad = async () => {
    setConfirmModal((prev) => ({ ...prev, open: false }))
    setLoadProgress('正在强制加载数据，请稍候...')
    setLoadResult(null)

    try {
      const res = await adminApi.forceLoadKlineData(
        confirmModal.startDate,
        confirmModal.endDate || undefined,
        confirmModal.period
      )
      const data = extractApiData(res)
      setLoadProgress(null)
      const loadedCount = data.loaded || data.count || data.inserted || 0
      setLoadResult({ count: loadedCount, period: confirmModal.period })
      toast.success(`成功加载 ${loadedCount} 条K线数据`)
      loadStatus()
    } catch (err: any) {
      setLoadProgress(null)
      toast.error(err.response?.data?.message || err.response?.data?.error || '强制加载数据失败')
    }
  }

  const getPeriodLabel = (value: string) => {
    return periods.find((p) => p.value === value)?.label || value
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#e0e0ff]">
          K线数据<HolographicText color="gold">管理</HolographicText>
        </h1>
        <p className="text-sm text-[#8888aa] mt-1">加载和管理历史K线数据</p>
      </div>

      {/* 数据加载控制 */}
      <GlowCard color="gold">
        <div className="flex items-center gap-2 mb-4">
          <CandlestickChart size={18} className="text-gold" />
          <h3 className="text-base font-semibold text-[#e0e0ff]">加载K线数据</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#8888aa]">
              <Calendar size={14} className="inline mr-1" />
              起始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-[#e0e0ff] placeholder-[#8888aa]/50 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all duration-300"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#8888aa]">
              <Calendar size={14} className="inline mr-1" />
              结束日期（可选）
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-[#e0e0ff] placeholder-[#8888aa]/50 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all duration-300"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#8888aa]">
              <Clock size={14} className="inline mr-1" />
              K线周期
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-[#e0e0ff] focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all duration-300"
            >
              {periods.map((p) => (
                <option key={p.value} value={p.value} className="bg-dark-800 text-[#e0e0ff]">
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="gold"
              size="md"
              glow
              onClick={handleLoad}
              disabled={!!loadProgress}
              className="w-full"
            >
              {loadProgress ? (
                <>
                  <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  加载中...
                </>
              ) : (
                <>
                  <Play size={16} />
                  加载数据
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 进度提示 */}
        {loadProgress && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gold/5 border border-gold/20 mb-4">
            <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gold">{loadProgress}</span>
          </div>
        )}

        {/* 加载结果 */}
        {loadResult && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-neon-green/5 border border-neon-green/20">
            <CheckCircle size={18} className="text-neon-green" />
            <span className="text-sm text-neon-green">
              成功加载 <span className="font-mono font-bold">{loadResult.count}</span> 条 {getPeriodLabel(loadResult.period)} K线数据
            </span>
          </div>
        )}
      </GlowCard>

      {/* 当前数据状态 */}
      <GlowCard color="cyan">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-cyan-glow" />
            <h3 className="text-base font-semibold text-[#e0e0ff]">数据状态</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={loadStatus} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-cyan-glow border-t-transparent rounded-full animate-spin" />
          </div>
        ) : statuses.length > 0 ? (
          <div className="space-y-3">
            {statuses.map((s) => (
              <div
                key={s.period}
                className="flex items-center justify-between py-3 px-4 rounded-lg bg-dark-800/30 border border-[rgba(0,240,255,0.05)]"
              >
                <div className="flex items-center gap-4">
                  <Badge variant={s.count > 0 ? 'cyan' : 'gray'} size="md">
                    {getPeriodLabel(s.period)}
                  </Badge>
                  <div>
                    <p className="text-sm text-[#e0e0ff]">
                      {s.count > 0 ? (
                        <>
                          <span className="font-mono font-bold">{s.count.toLocaleString()}</span> 条数据
                        </>
                      ) : (
                        <span className="text-[#8888aa]">暂无数据</span>
                      )}
                    </p>
                    {s.from && s.to && (
                      <p className="text-xs text-[#8888aa] mt-0.5">
                        范围：{s.from} ~ {s.to}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  {s.count > 0 ? (
                    <Badge variant="green" size="sm">已加载</Badge>
                  ) : (
                    <Badge variant="gray" size="sm">未加载</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Database size={32} className="mx-auto text-[#8888aa]/50 mb-2" />
            <p className="text-sm text-[#8888aa]">暂无K线数据状态</p>
          </div>
        )}
      </GlowCard>

      {/* 确认覆盖对话框 */}
      <Modal
        open={confirmModal.open}
        onOpenChange={(open) => setConfirmModal((prev) => ({ ...prev, open }))}
        title="数据覆盖确认"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-neon-red/5 border border-neon-red/20">
            <AlertTriangle size={20} className="text-neon-red flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[#e0e0ff]">
                该日期后已有数据（从 <span className="font-mono text-gold">{confirmModal.existingRange}</span>），是否覆盖？
              </p>
              <p className="text-xs text-[#8888aa] mt-1">覆盖后原有数据将被删除并重新加载</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="sm" onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}>
              取消
            </Button>
            <Button variant="danger" size="sm" onClick={handleForceLoad}>
              确认覆盖
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
