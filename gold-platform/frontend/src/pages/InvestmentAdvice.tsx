import { Lightbulb, Lock, CheckCircle, ArrowUpRight, RefreshCw } from 'lucide-react'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { useGoldData } from '../contexts/GoldDataContext'
import { useAuth, MembershipGate } from '../lib/auth'
import { useTranslation } from '../contexts/LanguageContext'

export default function InvestmentAdvice() {
  const { analysis, loading, refreshAnalysis } = useGoldData()
  const { user } = useAuth()
  const t = useTranslation()

  if (loading && !analysis) {
    return <Loading text={t.common.loading} />
  }

  const defaultAdvice = [
    { id: '1', level: 'free', title: t.investment.advice_items.fed_policy, description: t.investment.advice_items.fed_policy_desc, action: t.investment.advice_items.fed_policy_action },
    { id: '2', level: 'free', title: t.investment.advice_items.diversify, description: t.investment.advice_items.diversify_desc, action: t.investment.advice_items.diversify_action },
    { id: '3', level: 'basic', title: t.investment.advice_items.tech_support, description: t.investment.advice_items.tech_support_desc, action: t.investment.advice_items.tech_support_action },
    { id: '4', level: 'basic', title: t.investment.advice_items.seasonal, description: t.investment.advice_items.seasonal_desc, action: t.investment.advice_items.seasonal_action },
    { id: '5', level: 'pro', title: t.investment.advice_items.quant_hedge, description: t.investment.advice_items.quant_hedge_desc, action: t.investment.advice_items.quant_hedge_action },
    { id: '6', level: 'pro', title: t.investment.advice_items.options, description: t.investment.advice_items.options_desc, action: t.investment.advice_items.options_action },
    { id: '7', level: 'enterprise', title: t.investment.advice_items.custom_allocation, description: t.investment.advice_items.custom_allocation_desc, action: t.investment.advice_items.custom_allocation_action },
  ]

  const advice = (analysis?.investmentAdvice?.length ?? 0) > 0
    ? analysis!.investmentAdvice
    : defaultAdvice

  const levelOrder = ['free', 'basic', 'pro', 'enterprise']
  const userLevelIndex = levelOrder.indexOf(user?.membershipLevel || 'free')

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            {t.investment.title_part1}<HolographicText color="gold">{t.investment.title_part2}</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{t.investment.subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshAnalysis}>
          <RefreshCw size={14} /> {t.common.refresh}
        </Button>
      </div>

      {/* Current Membership */}
      <GlowCard color="gold" className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
            <Lightbulb size={24} className="text-gold" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#e0e0ff]">{t.investment.current_level}</h3>
            <p className="text-sm text-[#8888aa]">
              {user?.membershipLevel === 'pro' ? t.investment.pro :
               user?.membershipLevel === 'basic' ? t.investment.basic :
               user?.membershipLevel === 'enterprise' ? t.investment.enterprise : t.investment.free}
            </p>
          </div>
        </div>
        <Badge variant="gold" size="md">
          {user?.membershipLevel?.toUpperCase() || 'FREE'}
        </Badge>
      </GlowCard>

      {/* Advice Cards by Level */}
      <div className="space-y-6">
        {['free', 'basic', 'pro', 'enterprise'].map((level, levelIndex) => {
          const levelAdvice = advice.filter(a => a.level === level)
          const isLocked = levelIndex > userLevelIndex

          const levelNames: Record<string, string> = {
            free: t.investment.free,
            basic: t.investment.basic,
            pro: t.investment.pro,
            enterprise: t.investment.enterprise,
          }

          const levelColors: Record<string, 'cyan' | 'gold' | 'blue' | 'green'> = {
            free: 'cyan',
            basic: 'gold',
            pro: 'blue',
            enterprise: 'green',
          }

          return (
            <div key={level}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-[#e0e0ff]">{levelNames[level]} {t.investment.advice}</h2>
                <Badge variant={levelColors[level]}>{level.toUpperCase()}</Badge>
                {isLocked && <Lock size={14} className="text-[#8888aa]" />}
              </div>

              {isLocked ? (
                <GlowCard color={levelColors[level]} className="text-center py-8 opacity-60">
                  <Lock size={32} className="mx-auto text-[#8888aa] mb-3" />
                  <p className="text-sm text-[#8888aa]">{t.investment?.upgrade_to_unlock?.replace('{level}', levelNames[level]) || `${t.investment.upgrade_to} ${levelNames[level]} ${t.investment.unlock_advice}`}</p>
                </GlowCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(levelAdvice.length > 0 ? levelAdvice : defaultAdvice.filter(a => a.level === level)).map((item, index) => (
                    <GlowCard key={item.id || index} color={levelColors[level]}>
                      <div className="flex items-start gap-3">
                        <CheckCircle size={18} className={
                          levelColors[level] === 'cyan' ? 'text-cyan-glow' :
                          levelColors[level] === 'gold' ? 'text-gold' :
                          levelColors[level] === 'blue' ? 'text-electric-blue' :
                          'text-neon-green'
                        } />
                        <div>
                          <h4 className="text-sm font-semibold text-[#e0e0ff] mb-1">{item.title}</h4>
                          <p className="text-xs text-[#8888aa] leading-relaxed">{item.description}</p>
                          {item.action && (
                            <div className="mt-2 flex items-center gap-1 text-xs">
                              <ArrowUpRight size={12} className={
                                levelColors[level] === 'cyan' ? 'text-cyan-glow' :
                                levelColors[level] === 'gold' ? 'text-gold' :
                                levelColors[level] === 'blue' ? 'text-electric-blue' :
                                'text-neon-green'
                              } />
                              <span className={
                                levelColors[level] === 'cyan' ? 'text-cyan-glow' :
                                levelColors[level] === 'gold' ? 'text-gold' :
                                levelColors[level] === 'blue' ? 'text-electric-blue' :
                                'text-neon-green'
                              }>{item.action}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </GlowCard>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

