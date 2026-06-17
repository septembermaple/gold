import { useNavigate } from 'react-router-dom'
import { TrendingUp, Brain, Building2, Shield, Zap, BarChart3, ArrowRight, ChevronDown } from 'lucide-react'
import Button from '../components/ui/Button'
import GlowCard from '../components/ui/GlowCard'
import HolographicText from '../components/ui/HolographicText'
import Badge from '../components/ui/Badge'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'
import { useGoldData } from '../contexts/GoldDataContext'
import { formatPrice, formatPercent, getPriceColor } from '../lib/utils'
import { useTranslation } from '../contexts/LanguageContext'

export default function Home() {
  const navigate = useNavigate()
  const { stats } = useGoldData()
  const isLoggedIn = !!localStorage.getItem('token')
  const t = useTranslation()

  const features = [
    {
      icon: Brain,
      title: t.home.features.ai_analysis,
      description: t.home.features.ai_analysis_desc,
      color: 'cyan' as const,
    },
    {
      icon: TrendingUp,
      title: t.home.features.realtime_data,
      description: t.home.features.realtime_data_desc,
      color: 'gold' as const,
    },
    {
      icon: Building2,
      title: t.home.features.institution_views,
      description: t.home.features.institution_views_desc,
      color: 'blue' as const,
    },
    {
      icon: Shield,
      title: t.home.features.investment_advice,
      description: t.home.features.investment_advice_desc,
      color: 'green' as const,
    },
    {
      icon: Zap,
      title: t.home.features.smart_push,
      description: t.home.features.smart_push_desc,
      color: 'cyan' as const,
    },
    {
      icon: BarChart3,
      title: t.home.features.factor_analysis,
      description: t.home.features.factor_analysis_desc,
      color: 'gold' as const,
    },
  ]

  return (
    <div className="min-h-screen bg-dark-900 grid-bg relative overflow-hidden">
      {/* Top bar with logo and language switcher */}
      <div className="fixed top-0 left-0 right-0 z-[90] bg-dark-900/80 backdrop-blur-md border-b border-[rgba(0,240,255,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-glow to-electric-blue flex items-center justify-center">
              <span className="text-dark-900 font-bold text-xs">Au</span>
            </div>
            <span className="text-lg font-bold glow-text">GoldAI</span>
          </div>
          <LanguageSwitcher />
        </div>
      </div>

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
            <span className="text-[#e0e0ff]">{t.home.title}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-[#8888aa] max-w-2xl mx-auto leading-relaxed">
            {t.home.description}
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
              {t.home.get_started} <ArrowRight size={18} />
            </Button>
            <Button variant="ghost" size="lg" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              {t.home.learn_more} <ChevronDown size={18} />
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-[#e0e0ff] mb-4">
            {t.home.core}<span className="glow-text text-cyan-glow">{t.home.features_title}</span>
          </h2>
          <p className="text-[#8888aa] max-w-xl mx-auto">
            {t.home.features_subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <GlowCard
              key={feature.title}
              color={feature.color}
              className="animate-slide-up min-h-[180px]"
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
              {t.home.cta_title}
            </h2>
            <p className="text-[#8888aa] mb-8 max-w-lg mx-auto">
              {t.home.cta_description}
            </p>
            <Button variant="gold" size="lg" glow onClick={() => navigate(isLoggedIn ? '/dashboard' : '/register')}>
              {isLoggedIn ? t.home.enter_dashboard : t.home.register_now} <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(0,240,255,0.08)] bg-dark-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="p-3 rounded-lg bg-gold/5 border border-gold/15 text-xs text-[#aaa89a] leading-relaxed text-center mb-4">
            <span className="text-gold font-medium">{t.common.risk_warning.split('：')[0]}：</span>{t.common.risk_warning.split('：')[1]}
          </div>
          <p className="text-center text-sm text-[#8888aa]">{t.home.footer}</p>
        </div>
      </footer>
    </div>
  )
}
