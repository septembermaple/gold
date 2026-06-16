import { Lightbulb, Lock, CheckCircle, ArrowUpRight, RefreshCw } from 'lucide-react'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Loading from '../components/ui/Loading'
import { useGoldData } from '../contexts/GoldDataContext'
import { useAuth, MembershipGate } from '../lib/auth'

export default function InvestmentAdvice() {
  const { analysis, loading, refreshAnalysis } = useGoldData()
  const { user } = useAuth()

  if (loading && !analysis) {
    return <Loading text="加载投资建议..." />
  }

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
            投资<HolographicText color="gold">建议</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">根据会员等级提供差异化投资策略建议</p>
        </div>
        <Button variant="ghost" size="sm" onClick={refreshAnalysis}>
          <RefreshCw size={14} /> 刷新
        </Button>
      </div>

      {/* Current Membership */}
      <GlowCard color="gold" className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
            <Lightbulb size={24} className="text-gold" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#e0e0ff]">当前会员等级</h3>
            <p className="text-sm text-[#8888aa]">
              {user?.membershipLevel === 'pro' ? '专业版' :
               user?.membershipLevel === 'basic' ? '基础版' :
               user?.membershipLevel === 'enterprise' ? '企业版' : '免费版'}
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
            free: '免费版',
            basic: '基础版',
            pro: '专业版',
            enterprise: '企业版',
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
                <h2 className="text-lg font-semibold text-[#e0e0ff]">{levelNames[level]} 建议</h2>
                <Badge variant={levelColors[level]}>{level.toUpperCase()}</Badge>
                {isLocked && <Lock size={14} className="text-[#8888aa]" />}
              </div>

              {isLocked ? (
                <GlowCard color={levelColors[level]} className="text-center py-8 opacity-60">
                  <Lock size={32} className="mx-auto text-[#8888aa] mb-3" />
                  <p className="text-sm text-[#8888aa]">升级到 {levelNames[level]} 解锁此级别投资建议</p>
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

const defaultAdvice = [
  { id: '1', level: 'free', title: '关注美联储政策动向', description: '美联储利率决议是影响金价的最重要因素，建议密切关注每次FOMC会议声明', action: '建议关注' },
  { id: '2', level: 'free', title: '分散投资降低风险', description: '黄金在投资组合中建议占比5-15%，可有效分散风险', action: '适度配置' },
  { id: '3', level: 'basic', title: '技术面关键支撑位', description: '当前金价在$2,450附近形成强支撑，若有效跌破需警惕进一步下行', action: '设置止损' },
  { id: '4', level: 'basic', title: '季节性规律参考', description: '历史数据显示黄金在年初和年末通常表现较好，可据此调整仓位', action: '择时配置' },
  { id: '5', level: 'pro', title: '量化对冲策略', description: '利用黄金与美元指数的负相关性，构建对冲组合降低系统性风险', action: '执行对冲' },
  { id: '6', level: 'pro', title: '期权策略建议', description: '当前波动率环境下，建议采用看涨期权价差策略，控制成本的同时保留上行空间', action: '期权组合' },
  { id: '7', level: 'enterprise', title: '定制化资产配置', description: '根据企业风险偏好和现金流需求，提供定制化黄金资产配置方案', action: '专属方案' },
]
