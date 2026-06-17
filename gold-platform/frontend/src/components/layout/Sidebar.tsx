import { Link, useLocation } from 'react-router-dom'
import { BarChart3, TrendingUp, Building2, Lightbulb, User, Settings, Users, Shield, CreditCard, Server, Globe, Zap, Heart, Star, ShieldAlert, Brain } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext'
import { cn } from '../../lib/utils'

interface SidebarProps {
  variant?: 'main' | 'admin'
}

export default function Sidebar({ variant = 'main' }: SidebarProps) {
  const t = useTranslation()
  const location = useLocation()

  const mainLinks = [
    { path: '/dashboard', label: t.common.dashboard, icon: BarChart3 },
    { path: '/macro', label: t.common.macro, icon: Globe },
    { path: '/signals', label: t.common.signals, icon: Zap },
    { path: '/sentiment', label: t.common.sentiment, icon: Heart },
    { path: '/scoring', label: t.common.scoring, icon: Star },
    { path: '/risk', label: t.common.risk, icon: ShieldAlert },
    { path: '/ai-analysis', label: t.common.ai_analysis, icon: Brain },
    { path: '/analysis', label: t.common.analysis, icon: TrendingUp },
    { path: '/institution-views', label: t.common.institution_views, icon: Building2 },
    { path: '/investment-advice', label: t.common.investment_advice, icon: Lightbulb },
    { path: '/profile', label: t.common.profile, icon: User },
  ]

  const adminLinks = [
    { path: '/admin', label: t.common.admin, icon: BarChart3 },
    { path: '/admin/users', label: `${t.common.admin} - Users`, icon: Users },
    { path: '/admin/memberships', label: `${t.common.admin} - Memberships`, icon: CreditCard },
    { path: '/admin/permissions', label: `${t.common.admin} - Permissions`, icon: Shield },
    { path: '/admin/system', label: `${t.common.admin} - System`, icon: Server },
  ]

  const links = variant === 'admin' ? adminLinks : mainLinks

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-[calc(100vh-4rem)] bg-dark-800/30 border-r border-[rgba(0,240,255,0.08)] py-4 px-3">
      <nav className="space-y-1">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
              isActive(link.path)
                ? 'text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 glow-border'
                : 'text-[#8888aa] hover:text-[#e0e0ff] hover:bg-white/5 border border-transparent'
            )}
          >
            <link.icon size={18} />
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-4 border-t border-[rgba(0,240,255,0.08)]">
        <div className="px-3 py-2 text-xs text-[#8888aa]">
          <div className="flex items-center gap-1.5 mb-1">
            <Settings size={12} />
            <span>GoldAI v1.0</span>
          </div>
          <p>AI Agent 黄金市场智能分析平台</p>
        </div>
      </div>
    </aside>
  )
}
