import { Outlet, Link, useLocation } from 'react-router-dom'
import { BarChart3, Users, CreditCard, Shield, Server, ArrowLeft, CandlestickChart } from 'lucide-react'
import { cn } from '../../lib/utils'

const adminLinks = [
  { path: '/admin', label: '管理概览', icon: BarChart3 },
  { path: '/admin/users', label: '用户管理', icon: Users },
  { path: '/admin/memberships', label: '会员管理', icon: CreditCard },
  { path: '/admin/permissions', label: '权限管理', icon: Shield },
  { path: '/admin/system', label: '系统设置', icon: Server },
  { path: '/admin/kline-data', label: 'K线数据', icon: CandlestickChart },
]

export default function AdminLayout() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-dark-900 grid-bg">
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 glass-dark border-b border-[rgba(0,240,255,0.1)] h-16 flex items-center px-6">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center glow-border-gold">
            <span className="text-dark-900 font-bold text-sm">Au</span>
          </div>
          <span className="text-lg font-bold glow-text-gold">管理后台</span>
        </div>
        <div className="ml-auto">
          <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-[#8888aa] hover:text-[#e0e0ff] transition-colors">
            <ArrowLeft size={14} /> 返回前台
          </Link>
        </div>
      </div>

      <div className="pt-16 flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 min-h-[calc(100vh-4rem)] bg-dark-800/30 border-r border-[rgba(0,240,255,0.08)] py-4 px-3">
          <nav className="space-y-1">
            {adminLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200',
                  isActive(link.path)
                    ? 'text-gold bg-gold/10 border border-gold/20 glow-border-gold'
                    : 'text-[#8888aa] hover:text-[#e0e0ff] hover:bg-white/5 border border-transparent'
                )}
              >
                <link.icon size={18} />
                {link.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
