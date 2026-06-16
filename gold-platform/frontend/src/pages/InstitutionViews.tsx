import { Building2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { useGoldData } from '../contexts/GoldDataContext'
import { formatPrice, formatTime } from '../lib/utils'

export default function InstitutionViews() {
  const { analysis, loading, refreshAnalysis } = useGoldData()

  if (loading && !analysis) {
    return <Loading text="加载机构观点..." />
  }

  const views = (analysis?.institutionViews?.length ?? 0) > 0
    ? analysis!.institutionViews
    : defaultViews

  const getViewIcon = (view: string) => {
    if (view?.includes('看涨') || view?.includes('买入') || view?.includes('增持')) return TrendingUp
    if (view?.includes('看跌') || view?.includes('卖出') || view?.includes('减持')) return TrendingDown
    return Minus
  }

  const getViewColor = (view: string) => {
    if (view?.includes('看涨') || view?.includes('买入') || view?.includes('增持')) return 'green' as const
    if (view?.includes('看跌') || view?.includes('卖出') || view?.includes('减持')) return 'red' as const
    return 'gold' as const
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            机构<HolographicText color="gold">观点</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">全球顶级金融机构黄金市场预测汇总</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshAnalysis}>
          <RefreshCw size={14} /> 刷新
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <GlowCard color="green" className="text-center">
          <TrendingUp size={24} className="mx-auto text-neon-green mb-2" />
          <p className="text-2xl font-mono font-bold text-neon-green">
            {views.filter(v => v.view?.includes('看涨') || v.view?.includes('买入')).length}
          </p>
          <p className="text-xs text-[#8888aa]">看涨机构</p>
        </GlowCard>
        <GlowCard color="gold" className="text-center">
          <Minus size={24} className="mx-auto text-gold mb-2" />
          <p className="text-2xl font-mono font-bold text-gold">
            {views.filter(v => v.view?.includes('中性') || v.view?.includes('持有')).length}
          </p>
          <p className="text-xs text-[#8888aa]">中性机构</p>
        </GlowCard>
        <GlowCard color="red" className="text-center">
          <TrendingDown size={24} className="mx-auto text-neon-red mb-2" />
          <p className="text-2xl font-mono font-bold text-neon-red">
            {views.filter(v => v.view?.includes('看跌') || v.view?.includes('卖出')).length}
          </p>
          <p className="text-xs text-[#8888aa]">看跌机构</p>
        </GlowCard>
      </div>

      {/* Institution Views List */}
      <div className="space-y-4">
        {views.map((view, index) => {
          const ViewIcon = getViewIcon(view.view)
          const color = getViewColor(view.view)
          return (
            <GlowCard key={view.id || index} color={color}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  color === 'green' ? 'bg-neon-green/10' :
                  color === 'red' ? 'bg-neon-red/10' :
                  'bg-gold/10'
                }`}>
                  <Building2 size={22} className={
                    color === 'green' ? 'text-neon-green' :
                    color === 'red' ? 'text-neon-red' :
                    'text-gold'
                  } />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-[#e0e0ff]">{view.institution}</h3>
                    <div className="flex items-center gap-2">
                      {view.targetPrice && (
                        <Badge variant="cyan" size="sm">
                          目标价: ${formatPrice(view.targetPrice)}
                        </Badge>
                      )}
                      <Badge variant={color === 'green' ? 'green' : color === 'red' ? 'red' : 'gold'} size="sm">
                        <ViewIcon size={12} className="mr-1" />
                        {view.view}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-[#8888aa] leading-relaxed">
                    {view.institution}对黄金市场持{view.view}态度
                    {view.targetPrice && `，目标价位 $${formatPrice(view.targetPrice)}`}
                  </p>
                  {view.date && (
                    <p className="text-xs text-[#8888aa]/60 mt-2">
                      更新时间: {formatTime(view.date)}
                    </p>
                  )}
                </div>
              </div>
            </GlowCard>
          )
        })}
      </div>
    </div>
  )
}

const defaultViews = [
  { id: '1', institution: 'Goldman Sachs', view: '看涨', targetPrice: 4650, date: '2026-06-01' },
  { id: '2', institution: 'JP Morgan', view: '看涨', targetPrice: 4550, date: '2026-06-01' },
  { id: '3', institution: 'UBS', view: '看涨', targetPrice: 4500, date: '2026-05-28' },
  { id: '4', institution: 'Bank of America', view: '中性', targetPrice: 4350, date: '2026-05-25' },
  { id: '5', institution: 'Citigroup', view: '看涨', targetPrice: 4700, date: '2026-05-20' },
  { id: '6', institution: 'Morgan Stanley', view: '中性', targetPrice: 4300, date: '2026-05-18' },
]
