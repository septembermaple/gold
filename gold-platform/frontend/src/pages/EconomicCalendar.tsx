import { useState, useCallback, useEffect, useMemo } from 'react'
import { Calendar, Clock, AlertTriangle, Info, ChevronLeft, ChevronRight, Search, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import Button from '../components/ui/Button'
import { toast } from 'sonner'
import { calendarApi } from '../lib/api'

interface CalendarEvent {
  id: string
  date: string
  time: string
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  country: string
  previous?: string
  expected?: string
  actual?: string
}

type ImpactFilter = 'high' | 'medium' | 'low' | 'all'

const impactColorClass: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400 border border-red-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  low: 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30',
}

const impactDot: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-cyan-500',
}

// 中文标签
const zh: Record<string, string> = {
  title: '经济日历',
  subtitle: '影响黄金市场的重大事件与经济数据发布日程',
  searchPlaceholder: '搜索事件、国家…',
  refresh: '刷新',
  reset: '重置',
  loading: '加载中…',
  noEvents: '当前筛选条件下暂无事件',
  nextThreeDays: '未来 3 天',
  defaultView: '默认视图',
  selected: '已选日期',
  previous: '前值',
  expected: '预期',
  actual: '实际',
  allDay: '全天',
  impact: '影响程度',
  filterAll: '全部',
  filterHigh: '高影响',
  filterMedium: '中影响',
  filterLow: '低影响',
}

// 英文标签
const en: Record<string, string> = {
  title: 'Economic Calendar',
  subtitle: 'Major events & economic releases impacting the gold market',
  searchPlaceholder: 'Search events / countries…',
  refresh: 'Refresh',
  reset: 'Reset',
  loading: 'Loading…',
  noEvents: 'No events under the current filters',
  nextThreeDays: 'Next 3 days',
  defaultView: 'Default view',
  selected: 'Selected',
  previous: 'Previous',
  expected: 'Expected',
  actual: 'Actual',
  allDay: 'All day',
  impact: 'Impact',
  filterAll: 'All',
  filterHigh: 'High',
  filterMedium: 'Medium',
  filterLow: 'Low',
}

function useLabels(language: string) {
  return useMemo(() => (language === 'zh-CN' ? zh : en), [language])
}

function getTodayISO() {
  return new Date().toISOString().split('T')[0]
}

function formatFullDate(dateStr: string, language: string) {
  try {
    const d = new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return dateStr
    const parts: string[] = []
    if (language === 'zh-CN') {
      const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()]
      parts.push(`${weekday} ${d.getMonth() + 1}月${d.getDate()}日`)
    } else {
      parts.push(d.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric' }))
    }
    return parts.join(' ')
  } catch {
    return dateStr
  }
}

function getWeekdays(language: string, count = 7): string[] {
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    if (language === 'zh-CN') {
      result.push(['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()])
    } else {
      result.push(d.toLocaleDateString(language, { weekday: 'short' }))
    }
  }
  return result
}

function getMonthDay(language: string, count = 7): string[] {
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    if (language === 'zh-CN') {
      result.push(`${d.getMonth() + 1}月${d.getDate()}日`)
    } else {
      result.push(d.toLocaleDateString(language, { month: 'short', day: 'numeric' }))
    }
  }
  return result
}

function getDateList(count = 7): string[] {
  const result: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    result.push(d.toISOString().split('T')[0])
  }
  return result
}

export default function EconomicCalendar({ language = 'en-US' }: { language?: string }) {
  const labels = useLabels(language)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>('high')

  const fetchEvents = useCallback(async (_date?: string) => {
    try {
      setLoading(true)
      const res = await calendarApi.getCalendar({ lang: language, from: getTodayISO(), to: getTodayISO() })
      const apiEvents: CalendarEvent[] = Array.isArray(res?.data) ? res.data : []
      // 为每个事件填充今天日期（NAS API 返回当天的事件，不包含具体日期字段）
      const today = getTodayISO()
      const normalized = apiEvents.map((e, idx) => ({
        ...e,
        date: e.date || today,
        id: e.id || `ev_${idx}_${Date.now()}`,
        title: e.title || '(untitled)',
        impact: e.impact || 'low',
      }))
      setAllEvents(normalized)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(labels.title, { description: message })
      setAllEvents([])
    } finally {
      setLoading(false)
    }
  }, [language, labels.title])

  // 初次加载
  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  // 本地筛选
  const filteredEvents = useMemo(() => {
    const today = getTodayISO()
    const base = selectedDate
      ? allEvents.filter((e) => (e.date || today) === selectedDate)
      : allEvents
    return base
      .filter((e) => impactFilter === 'all' || e.impact === impactFilter)
      .filter((e) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
          e.title.toLowerCase().includes(q) ||
          (e.country || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => {
        // 按影响级别排序：high -> medium -> low
        const order: Record<string, number> = { high: 0, medium: 1, low: 2 }
        if (order[a.impact] !== order[b.impact]) return order[a.impact] - order[b.impact]
        return (a.time || '').localeCompare(b.time || '')
      })
  }, [allEvents, selectedDate, impactFilter, searchQuery])

  const weekdays = getWeekdays(language, 7)
  const monthDays = getMonthDay(language, 7)
  const dateList = getDateList(7)

  const handleDateSelect = (date: string) => {
    setSelectedDate((prev) => (prev === date ? '' : date))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">{labels.title}</h1>
          <p className="text-sm text-[#8888aa] mt-1">{labels.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => fetchEvents(selectedDate || undefined)}>
          <RefreshCw size={14} className="mr-1" /> {labels.refresh}
        </Button>
      </div>

      {/* Date Selector */}
      <div className="glass p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => {
                const idx = dateList.indexOf(selectedDate)
                if (idx > 0) handleDateSelect(dateList[idx - 1])
              }}
              className="p-2 rounded-lg hover:bg-white/5 text-[#8888aa] hover:text-[#e0e0ff] flex-shrink-0"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-2">
              {dateList.map((date, i) => (
                <button
                  key={date}
                  onClick={() => handleDateSelect(date)}
                  className={
                    'flex flex-col items-center min-w-[64px] px-3 py-2 rounded-lg transition-all flex-shrink-0 ' +
                    (selectedDate === date
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : i === 0
                      ? 'bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'
                      : 'text-[#8888aa] hover:text-[#e0e0ff] hover:bg-white/5')
                  }
                >
                  <span className="text-xs">{weekdays[i]}</span>
                  <span className="text-lg font-bold">{monthDays[i]}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const idx = dateList.indexOf(selectedDate)
                if (idx < dateList.length - 1) handleDateSelect(dateList[idx + 1])
              }}
              className="p-2 rounded-lg hover:bg-white/5 text-[#8888aa] hover:text-[#e0e0ff] flex-shrink-0"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888aa]" />
              <input
                type="text"
                placeholder={labels.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 pl-10 pr-4 py-2 bg-dark-800 border border-[rgba(0,240,255,0.1)] rounded-lg text-sm text-[#e0e0ff] placeholder-[#8888aa] focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedDate('')
                setSearchQuery('')
                setImpactFilter('high')
                fetchEvents()
              }}
            >
              {labels.reset}
            </Button>
          </div>
        </div>

        {/* Impact filter */}
        <div className="mt-4 pt-4 border-t border-[rgba(0,240,255,0.1)] flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#8888aa] mr-2">{labels.impact}:</span>
          {([
            { k: 'high', label: labels.filterHigh },
            { k: 'medium', label: labels.filterMedium },
            { k: 'low', label: labels.filterLow },
            { k: 'all', label: labels.filterAll },
          ] as { k: ImpactFilter; label: string }[]).map((opt) => (
            <button
              key={opt.k}
              onClick={() => setImpactFilter(opt.k)}
              className={
                'px-3 py-1 rounded-full text-xs transition-all border ' +
                (impactFilter === opt.k
                  ? impactColorClass[opt.k] || 'bg-white/10 text-white'
                  : 'bg-white/5 text-[#8888aa] hover:text-[#e0e0ff] hover:bg-white/10')
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Date hint */}
        <div className="mt-3 text-xs text-[#8888aa]">
          {selectedDate
            ? `${labels.selected}: ${formatFullDate(selectedDate, language)}`
            : `${labels.defaultView}: ${labels.nextThreeDays} · ${labels.filterHigh}`}
        </div>
      </div>

      {/* Events */}
      <div className="space-y-3">
        {loading ? (
          <div className="glass p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-500/30 border-t-cyan-400 mx-auto mb-4" />
            <p className="text-sm text-[#8888aa]">{labels.loading}</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="glass p-12 text-center">
            <Calendar size={48} className="mx-auto mb-4 text-[#8888aa]/30" />
            <p className="text-sm text-[#8888aa]">{labels.noEvents}</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className="glass p-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-center gap-2 text-sm whitespace-nowrap flex-shrink-0">
                  <Clock size={14} className="text-cyan-400" />
                  <span className="text-[#8888aa] font-mono">
                    {event.time || labels.allDay}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium text-[#e0e0ff]">{event.title}</h3>
                    <span
                      className={'px-2 py-0.5 rounded-full text-xs border ' + impactColorClass[event.impact]}
                    >
                      {event.impact === 'high'
                        ? labels.filterHigh
                        : event.impact === 'medium'
                        ? labels.filterMedium
                        : labels.filterLow}
                    </span>
                    {event.country && (
                      <span className="text-xs text-[#8888aa]">{event.country}</span>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-xs text-[#9aa0b4] mb-3 leading-relaxed max-w-3xl">
                      {event.description}
                    </p>
                  )}

                  {(event.previous || event.expected || event.actual) && (
                    <div className="flex flex-wrap gap-4 text-xs">
                      {event.previous && (
                        <div className="flex items-center gap-1">
                          <Info size={12} className="text-[#8888aa]" />
                          <span className="text-[#8888aa]">{labels.previous}:</span>
                          <span className="text-[#e0e0ff] font-medium">{event.previous}</span>
                        </div>
                      )}
                      {event.expected && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle size={12} className="text-yellow-400" />
                          <span className="text-[#8888aa]">{labels.expected}:</span>
                          <span className="text-yellow-300 font-medium">{event.expected}</span>
                        </div>
                      )}
                      {event.actual && (
                        <div className="flex items-center gap-1">
                          {(parseNumberSafe(event.actual) ?? 0) > (parseNumberSafe(event.expected) || 0) ? (
                            <TrendingUp size={12} className="text-green-400" />
                          ) : (
                            <TrendingDown size={12} className="text-red-400" />
                          )}
                          <span className="text-[#8888aa]">{labels.actual}:</span>
                          <span className="text-green-400 font-medium">{event.actual}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className={'w-3 h-3 rounded-full flex-shrink-0 mt-1 ' + impactDot[event.impact]} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 从字符串中解析数字（例如 "3.4%" -> 3.4，"1.2M" -> 1.2）
function parseNumberSafe(s: string | undefined): number | null {
  if (!s) return null
  const m = String(s).match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}
