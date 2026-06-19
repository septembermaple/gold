import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart3, TrendingUp, Building2, Lightbulb, User, Settings, Users, Shield, CreditCard, Server, Globe, Zap, Heart, Star, ShieldAlert, Brain, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { useTranslation } from '../../contexts/LanguageContext'
import { cn } from '../../lib/utils'

interface SidebarProps {
  variant?: 'main' | 'admin'
}

export default function Sidebar({ variant = 'main' }: SidebarProps) {
  const t = useTranslation()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 1024
  })

  // 响应式：窗口大小变化时自动调整
  useEffect(() => {
    const handleResize = () => {
      setCollapsed(window.innerWidth < 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const mainLinks = [
    { path: '/dashboard', label: t.common.dashboard, icon: BarChart3 },
    { path: '/macro', label: t.common.macro, icon: Globe },
    { path: '/signals', label: t.common.signals, icon: Zap },
    { path: '/sentiment', label: t.common.sentiment, icon: Heart },
    { path: '/scoring', label: t.common.scoring, icon: Star },
    { path: '/risk', label: t.common.risk, icon: ShieldAlert },
    { path: '/calendar', label: t.common.calendar, icon: Calendar },
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

  const toggleCollapsed = () => setCollapsed(!collapsed)

  const LinkItem = ({ link }: { link: typeof links[0] }) => (
    <Link
      key={link.path}
      to={link.path}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
        collapsed ? 'justify-center px-2' : '',
        isActive(link.path)
          ? 'text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20 glow-border'
          : 'text-[#8888aa] hover:text-[#e0e0ff] hover:bg-white/5 border border-transparent'
      )}
    >
      <link.icon size={18} />
      {!collapsed && <span className="truncate">{link.label}</span>}
    </Link>
  )

  return (
    <aside
      className={cn(
        'flex flex-col bg-dark-800/30 border-r border-[rgba(0,240,255,0.08)] py-4 transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{ minHeight: 'calc(100vh - 4rem)' }}
    >
      {/* 折叠/展开按钮 - 始终在侧边栏边缘 */}
      <button
        onClick={toggleCollapsed}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-dark-800 border border-[rgba(0,240,255,0.1)] flex items-center justify-center text-[#8888aa] hover:text-cyan-glow hover:border-cyan-glow/30 transition-all duration-200 shadow-lg z-10"
        title={collapsed ? '展开菜单' : '折叠菜单'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Logo - 折叠时只显示图标 */}
      <div className={cn('px-3 mb-4', collapsed ? 'flex justify-center' : '')}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-glow to-electric-blue flex items-center justify-center flex-shrink-0">
            <span className="text-dark-900 font-bold text-xs">Au</span>
          </div>
          {!collapsed && <span className="text-lg font-bold glow-text">GoldAI</span>}
        </div>
      </div>

      <nav className="space-y-1">
        {links.map((link) => (
          <LinkItem key={link.path} link={link} />
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t border-[rgba(0,240,255,0.08)]">
        <div className={cn('px-3 py-2 text-xs text-[#8888aa]', collapsed ? 'text-center' : '')}>
          <div className={cn('flex items-center gap-1.5 mb-1', collapsed ? 'justify-center' : '')}>
            <Settings size={12} />
            <span>{collapsed ? '' : 'GoldAI v1.0'}</span>
          </div>
          {!collapsed && <p>{t.common.ai_agent_platform}</p>}
        </div>
      </div>
    </aside>
  )
}
