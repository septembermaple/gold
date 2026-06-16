import { Link, useLocation } from 'react-router-dom'
import { BarChart3, TrendingUp, Building2, Lightbulb, User, Settings, Users, Shield, CreditCard, Server, Globe, Zap, Heart, Star, ShieldAlert, Brain } from 'lucide-react'
import { cn } from '../../lib/utils'

interface SidebarProps {
  variant?: 'main' | 'admin'
}

export default function Sidebar({ variant = 'main' }: SidebarProps) {
  const location = useLocation()

  const mainLinks = [
    { path: '/dashboard', label: '仪表盘', icon: BarChart3 },
    { path: '/macro', label: '宏观分析', icon: Globe },
    { path: '/signals', label: '多空信号', icon: Zap },
    { path: '/sentiment', label: '市场情绪', icon: Heart },
    { path: '/scoring', label: '评分模型', icon: Star },
    { path: '/risk', label: '风险评估', icon: ShieldAlert },
    { path: '/ai-analysis', label: 'AI分析', icon: Brain },
    { path: '/analysis', label: '因子分析', icon: TrendingUp },
    { path: '/institution-views', label: '机构观点', icon: Building2 },
    { path: '/investment-advice', label: '投资建议', icon: Lightbulb },
    { path: '/profile', label: '个人中心', icon: User },
  ]

  const adminLinks = [
    { path: '/admin', label: '管理概览', icon: BarChart3 },
    { path: '/admin/users', label: '用户管理', icon: Users },
    { path: '/admin/memberships', label: '会员管理', icon: CreditCard },
    { path: '/admin/permissions', label: '权限管理', icon: Shield },
    { path: '/admin/system', label: '系统设置', icon: Server },
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
