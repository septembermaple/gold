import { useState, useCallback, useEffect } from 'react'
import { Calendar, Clock, AlertTriangle, Info, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useTranslation } from '../contexts/LanguageContext'
import Button from '../components/ui/Button'
import { toast } from 'sonner'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import { cn } from '../lib/utils'

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

// Mock data for economic calendar
const mockEvents: CalendarEvent[] = [
  {
    id: '1',
    date: '2026-06-18',
    time: '20:30',
    title: '美国 CPI 数据发布',
    description: '美国劳工统计局发布的消费者价格指数，是衡量通货膨胀的重要指标',
    impact: 'high',
    country: '美国',
    previous: '4.1%',
    expected: '3.9%',
    actual: '3.8%',
  },
  {
    id: '2',
    date: '2026-06-18',
    time: '22:00',
    title: '美联储官员讲话',
    description: '美联储主席鲍威尔在经济论坛上发表关于货币政策的讲话',
    impact: 'high',
    country: '美国',
  },
  {
    id: '3',
    date: '2026-06-19',
    time: '14:00',
    title: '欧元区 GDP 数据',
    description: '欧元区第一季度国内生产总值终值',
    impact: 'medium',
    country: '欧元区',
    previous: '0.3%',
    expected: '0.4%',
  },
  {
    id: '4',
    date: '2026-06-19',
    time: '20:30',
    title: '美国失业金申请人数',
    description: '美国首次申请失业救济金人数',
    impact: 'medium',
    country: '美国',
    previous: '215K',
    expected: '218K',
  },
  {
    id: '5',
    date: '2026-06-20',
    time: '09:30',
    title: '中国 GDP 数据',
    description: '中国第二季度国内生产总值同比增长',
    impact: 'high',
    country: '中国',
    expected: '5.2%',
  },
  {
    id: '6',
    date: '2026-06-20',
    time: '20:00',
    title: '美联储利率决议',
    description: '美联储公开市场委员会宣布最新利率决定',
    impact: 'high',
    country: '美国',
  },
  {
    id: '7',
    date: '2026-06-21',
    time: '17:00',
    title: '英国 CPI 数据',
    description: '英国消费者价格指数月度数据',
    impact: 'medium',
    country: '英国',
    previous: '3.8%',
    expected: '3.6%',
  },
  {
    id: '8',
    date: '2026-06-21',
    time: '20:30',
    title: '美国 PCE 数据',
    description: '美国个人消费支出价格指数，美联储首选通胀指标',
    impact: 'high',
    country: '美国',
    previous: '2.8%',
    expected: '2.7%',
  },
  {
    id: '9',
    date: '2026-06-22',
    time: '11:00',
    title: '日本央行政策会议',
    description: '日本央行货币政策委员会会议结果',
    impact: 'medium',
    country: '日本',
  },
  {
    id: '10',
    date: '2026-06-22',
    time: '14:30',
    title: '德国制造业 PMI',
    description: '德国Markit制造业采购经理人指数',
    impact: 'medium',
    country: '德国',
    previous: '45.2',
    expected: '45.5',
  },
]

const impactColors = {
  high: 'bg-neon-red/20 text-neon-red border-neon-red/30',
  medium: 'bg-gold/20 text-gold border-gold/30',
  low: 'bg-cyan-glow/20 text-cyan-glow border-cyan-glow/30',
}

const impactLabels = {
  high: '高影响',
  medium: '中影响',
  low: '低影响',
}

export default function EconomicCalendar() {
  const t = useTranslation()
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const getDateRange = () => {
    const today = new Date()
    const dates: string[] = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() + i)
      dates.push(date.toISOString().split('T')[0])
    }
    return dates
  }

  const fetchEvents = useCallback(async (date?: string) => {
    try {
      setLoading(true)
      // Filter mock data by date range (next 3 days by default)
      let filtered = mockEvents
      if (date) {
        filtered = mockEvents.filter(e => e.date === date)
      } else {
        const dates = getDateRange().slice(0, 3)
        filtered = mockEvents.filter(e => dates.includes(e.date))
      }
      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        filtered = filtered.filter(e => 
          e.title.toLowerCase().includes(query) ||
          e.description.toLowerCase().includes(query) ||
          e.country.toLowerCase().includes(query)
        )
      }
      setEvents(filtered)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error(t.common.error, { description: message })
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleDateSelect = (date: string) => {
    setSelectedDate(date)
    fetchEvents(date)
  }

  const handleReset = () => {
    setSelectedDate('')
    fetchEvents()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    return `${weekdays[date.getDay()]} ${date.getDate()}${months[date.getMonth()]}`
  }

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0]
    return dateStr === today
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            <HolographicText as="span" color="mixed">{t.calendar.title}</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{t.calendar.subtitle}</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="glass p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const dates = getDateRange()
                const currentIndex = dates.indexOf(selectedDate)
                if (currentIndex > 0) {
                  handleDateSelect(dates[currentIndex - 1])
                }
              }}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#8888aa] hover:text-[#e0e0ff]"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
              {getDateRange().map((date) => (
                <button
                  key={date}
                  onClick={() => handleDateSelect(date)}
                  className={cn(
                    'flex flex-col items-center min-w-[60px] px-3 py-2 rounded-lg transition-all',
                    selectedDate === date
                      ? 'bg-cyan-glow/20 text-cyan-glow border border-cyan-glow/30'
                      : isToday(date)
                        ? 'bg-gold/10 text-gold hover:bg-gold/20'
                        : 'text-[#8888aa] hover:text-[#e0e0ff] hover:bg-white/5'
                  )}
                >
                  <span className="text-xs">{formatDate(date).split(' ')[0]}</span>
                  <span className="text-lg font-bold">{formatDate(date).split(' ')[1]}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const dates = getDateRange()
                const currentIndex = dates.indexOf(selectedDate)
                if (currentIndex < dates.length - 1) {
                  handleDateSelect(dates[currentIndex + 1])
                }
              }}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-[#8888aa] hover:text-[#e0e0ff]"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Search and Reset */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888aa]" />
              <input
                type="text"
                placeholder={t.calendar.search_placeholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 pl-10 pr-4 py-2 bg-dark-800 border border-[rgba(0,240,255,0.1)] rounded-lg text-sm text-[#e0e0ff] placeholder-[#8888aa] focus:outline-none focus:border-cyan-glow/50"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              {t.common.reset}
            </Button>
          </div>
        </div>

        {/* Date Label */}
        {selectedDate ? (
          <div className="mt-4 pt-4 border-t border-[rgba(0,240,255,0.1)]">
            <p className="text-sm text-[#8888aa]">
              {t.calendar.selected_date}: <span className="text-[#e0e0ff] font-medium">{formatDate(selectedDate)}</span>
            </p>
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-[rgba(0,240,255,0.1)]">
            <p className="text-sm text-[#8888aa]">
              {t.calendar.default_view}: <span className="text-[#e0e0ff] font-medium">{t.calendar.next_three_days}</span>
            </p>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {loading ? (
          <div className="glass p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-cyan-glow/30 border-t-cyan-glow mx-auto mb-4" />
            <p className="text-sm text-[#8888aa]">{t.common.loading}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="glass p-12 text-center">
            <Calendar size={48} className="mx-auto mb-4 text-[#8888aa]/30" />
            <p className="text-sm text-[#8888aa]">{t.calendar.no_events}</p>
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="glass p-5 hover:bg-white/[0.02] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Time */}
                <div className="flex items-center gap-2 text-sm">
                  <Clock size={14} className="text-cyan-glow" />
                  <span className="text-[#8888aa] font-mono">{event.time}</span>
                  {!event.time && <span className="text-[#8888aa]">{t.calendar.all_day}</span>}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="text-sm font-medium text-[#e0e0ff]">{event.title}</h3>
                    <Badge className={impactColors[event.impact]}>{impactLabels[event.impact]}</Badge>
                    <span className="text-xs text-[#8888aa]">{event.country}</span>
                  </div>
                  <p className="text-xs text-[#8888aa] mb-3">{event.description}</p>

                  {/* Data Preview */}
                  {(event.previous || event.expected || event.actual) && (
                    <div className="flex flex-wrap gap-4 text-xs">
                      {event.previous && (
                        <div className="flex items-center gap-1">
                          <Info size={12} className="text-[#8888aa]" />
                          <span className="text-[#8888aa]">{t.calendar.previous}:</span>
                          <span className="text-[#e0e0ff]">{event.previous}</span>
                        </div>
                      )}
                      {event.expected && (
                        <div className="flex items-center gap-1">
                          <AlertTriangle size={12} className="text-gold" />
                          <span className="text-[#8888aa]">{t.calendar.expected}:</span>
                          <span className="text-gold">{event.expected}</span>
                        </div>
                      )}
                      {event.actual && (
                        <div className="flex items-center gap-1">
                          <span className="text-[#8888aa]">{t.calendar.actual}:</span>
                          <span className="text-neon-green font-medium">{event.actual}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Impact Indicator */}
                <div className={cn(
                  'w-3 h-3 rounded-full flex-shrink-0',
                  event.impact === 'high' ? 'bg-neon-red' :
                  event.impact === 'medium' ? 'bg-gold' : 'bg-cyan-glow'
                )} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
