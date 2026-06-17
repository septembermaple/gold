import { Building2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { useGoldData } from '../contexts/GoldDataContext'
import { formatPrice, formatTime, translateText } from '../lib/utils'
import { useTranslation } from '../contexts/LanguageContext'

export default function InstitutionViews() {
  const { analysis, loading, refreshAnalysis } = useGoldData()
  const t = useTranslation()

  if (loading && !analysis) {
    return <Loading text={t.common.loading} />
  }

  const views = (analysis?.institutionViews?.length ?? 0) > 0
    ? analysis!.institutionViews
    : defaultViews

  const getViewIcon = (view: string) => {
    if (view?.includes(t.institution.bullish) || view?.includes('Buy') || view?.includes('buy')) return TrendingUp
    if (view?.includes(t.institution.bearish) || view?.includes('Sell') || view?.includes('sell')) return TrendingDown
    return Minus
  }

  const getViewColor = (view: string) => {
    if (view?.includes(t.institution.bullish) || view?.includes('Buy') || view?.includes('buy')) return 'green' as const
    if (view?.includes(t.institution.bearish) || view?.includes('Sell') || view?.includes('sell')) return 'red' as const
    return 'gold' as const
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            {t.institution.title_part1}<HolographicText color="gold">{t.institution.title_part2}</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{t.institution.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshAnalysis}>
          <RefreshCw size={14} /> {t.common.refresh}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <GlowCard color="green" className="text-center">
          <TrendingUp size={24} className="mx-auto text-neon-green mb-2" />
          <p className="text-2xl font-mono font-bold text-neon-green">
            {views.filter(v => v.view?.includes(t.institution.bullish) || v.view?.includes('Buy')).length}
          </p>
          <p className="text-xs text-[#8888aa]">{t.institution.bullish_institutions}</p>
        </GlowCard>
        <GlowCard color="gold" className="text-center">
          <Minus size={24} className="mx-auto text-gold mb-2" />
          <p className="text-2xl font-mono font-bold text-gold">
            {views.filter(v => v.view?.includes(t.institution.neutral) || v.view?.includes('Hold')).length}
          </p>
          <p className="text-xs text-[#8888aa]">{t.institution.neutral_institutions}</p>
        </GlowCard>
        <GlowCard color="red" className="text-center">
          <TrendingDown size={24} className="mx-auto text-neon-red mb-2" />
          <p className="text-2xl font-mono font-bold text-neon-red">
            {views.filter(v => v.view?.includes(t.institution.bearish) || v.view?.includes('Sell')).length}
          </p>
          <p className="text-xs text-[#8888aa]">{t.institution.bearish_institutions}</p>
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
                          {t.institution.target_price}: ${formatPrice(view.targetPrice)}
                        </Badge>
                      )}
                      <Badge variant={color === 'green' ? 'green' : color === 'red' ? 'red' : 'gold'} size="sm">
                        <ViewIcon size={12} className="mr-1" />
                        {translateText(view.view, t)}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-[#8888aa] leading-relaxed">
                    {t.institution?.institution_view_desc?.replace('{institution}', view.institution).replace('{view}', view.view) || `${view.institution} ${t.institution.holds} ${view.view} ${t.institution.stance}`}
                  </p>
                  {view.date && (
                    <p className="text-xs text-[#8888aa]/60 mt-2">
                      {t.institution.update_time}: {formatTime(view.date)}
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
  { id: '1', institution: 'Goldman Sachs', view: 'Bullish', targetPrice: 4650, date: '2026-06-01' },
  { id: '2', institution: 'JP Morgan', view: 'Bullish', targetPrice: 4550, date: '2026-06-01' },
  { id: '3', institution: 'UBS', view: 'Bullish', targetPrice: 4500, date: '2026-05-28' },
  { id: '4', institution: 'Bank of America', view: 'Neutral', targetPrice: 4350, date: '2026-05-25' },
  { id: '5', institution: 'Citigroup', view: 'Bullish', targetPrice: 4700, date: '2026-05-20' },
  { id: '6', institution: 'Morgan Stanley', view: 'Neutral', targetPrice: 4300, date: '2026-05-18' },
]
