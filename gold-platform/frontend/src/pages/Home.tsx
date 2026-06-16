import { useNavigate } from 'react-router-dom'
import { TrendingUp, Brain, Building2, Shield, Zap, BarChart3, ArrowRight, ChevronDown } from 'lucide-react'
import Button from '../components/ui/Button'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import { useGoldData } from '../contexts/GoldDataContext'
import { formatPrice, formatPercent, getPriceColor } from '../lib/utils'

export default function Home() {
  const navigate = useNavigate()
  const { stats } = useGoldData()
  const isLoggedIn = !!localStorage.getItem('token')

  const features = [
    {
      icon: Brain,
      title: 'AI 智能分析',
      description: '基于大语言模型的深度市场分析，实时解读全球宏观经济与黄金走势',
      color: 'cyan' as const,
    },
    {
      icon: TrendingUp,
      title: '实时行情追踪',
      description: '国际金价 XAU/USD 与国内 AU9999 实时报价，K线图表一目了然',
      color: 'gold' as const,
    },
    {
      icon: Building2,
      title: '机构观点聚合',
      description: '全球顶级投行与机构黄金预测汇总，掌握市场主流观点',
      color: 'blue' as const,
    },
    {
      icon: Shield,
      title: '投资策略建议',
      description: '根据会员等级提供差异化投资建议，从入门到专业全覆盖',
      color: 'green' as const,
    },
    {
      icon: Zap,
      title: '智能推送',
      description: '关键行情异动即时推送，不错过任何重要交易机会',
      color: 'cyan' as const,
    },
    {
      icon: BarChart3,
      title: '多维度因子分析',
      description: '看涨/看跌因子量化评估，全方位解读市场驱动力量',
      color: 'gold' as const,
    },
  ]

  return (
    <div className="min-h-screen bg-dark-900 grid-bg relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-glow/5 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-electric-blue/5 rounded-full blur-[100px] animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-gold/5 rounded-full blur-[80px] animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Navbar spacer */}
      <div className="h-16" />

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center space-y-8 animate-fade-in">
          {/* Badge */}
          <div className="flex justify-center">
            <Badge variant="cyan" size="md" className="animate-pulse-glow">
              <Zap size={14} className="mr-1" /> AI-Powered Gold Analysis
            </Badge>
          </div>

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight">
            <HolographicText as="span" color="mixed" className="text-4xl sm:text-5xl lg:text-7xl">
              AI Agent
            </HolographicText>
            <br />
            <span className="text-[#e0e0ff]">黄金市场智能分析平台</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[#8888aa] max-w-2xl mx-auto leading-relaxed">
            融合人工智能与金融市场分析，为您提供实时行情、深度因子分析、
            机构观点聚合与个性化投资策略，助您精准把握黄金市场脉搏
          </p>

          {/* Live Price Preview */}
          {stats && (
            <div className="flex justify-center gap-6 sm:gap-10 py-6">
              <div className="text-center">
                <p className="text-xs text-[#8888aa] mb-1">XAU/USD</p>
                <p className={`text-2xl sm:text-3xl font-mono font-bold ${getPriceColor(stats.internationalChange)}`}>
                  ${formatPrice(stats.internationalPrice)}
                </p>
                <p className={`text-sm font-mono ${getPriceColor(stats.internationalChange)}`}>
                  {formatPercent(stats.internationalChange)}
                </p>
              </div>
              <div className="w-px bg-[rgba(0,240,255,0.15)]" />
              <div className="text-center">
                <p className="text-xs text-[#8888aa] mb-1">AU9999</p>
                <p className={`text-2xl sm:text-3xl font-mono font-bold ${getPriceColor(stats.domesticChange)}`}>
                  ¥{formatPrice(stats.domesticPrice)}
                </p>
                <p className={`text-sm font-mono ${getPriceColor(stats.domesticChange)}`}>
                  {formatPercent(stats.domesticChange)}
                </p>
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex justify-center gap-4">
            <Button variant="primary" size="lg" glow onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}>
              开始使用 <ArrowRight size={18} />
            </Button>
            <Button variant="ghost" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              了解更多 <ChevronDown size={18} />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e0e0ff] mb-4">
            核心<span className="glow-text text-cyan-glow">功能</span>
          </h2>
          <p className="text-[#8888aa] max-w-xl mx-auto">
            全方位黄金市场分析工具，从数据到决策一站式服务
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <GlowCard
              key={feature.title}
              color={feature.color}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-12 h-12 rounded-lg bg-${feature.color === 'cyan' ? 'cyan-glow' : feature.color === 'gold' ? 'gold' : feature.color === 'blue' ? 'electric-blue' : 'neon-green'}/10 flex items-center justify-center mb-4`}>
                <feature.icon size={24} className={
                  feature.color === 'cyan' ? 'text-cyan-glow' :
                  feature.color === 'gold' ? 'text-gold' :
                  feature.color === 'blue' ? 'text-electric-blue' :
                  'text-neon-green'
                } />
              </div>
              <h3 className="text-lg font-semibold text-[#e0e0ff] mb-2">{feature.title}</h3>
              <p className="text-sm text-[#8888aa] leading-relaxed">{feature.description}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="glass p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 holographic-bg opacity-30" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-[#e0e0ff] mb-4">
              开启您的<span className="neon-text-gold">黄金投资</span>智能之旅
            </h2>
            <p className="text-[#8888aa] mb-8 max-w-lg mx-auto">
              注册即可获得免费基础分析权限，升级会员解锁更多高级功能
            </p>
            <Button variant="gold" size="lg" glow onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}>
              {isLoggedIn ? '进入仪表盘' : '立即注册'} <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(0,240,255,0.08)] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-[#8888aa]">
          <p>© 2024 GoldAI - AI Agent 黄金市场智能分析平台</p>
        </div>
      </footer>
    </div>
  )
}
