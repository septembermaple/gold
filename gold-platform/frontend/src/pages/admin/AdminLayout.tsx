import { Outlet, Link, useLocation } from 'react-router-dom'
import { BarChart3, Users, CreditCard, Shield, Server, ArrowLeft, CandlestickChart } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useTranslation } from '../../contexts/LanguageContext'

const adminLinkDefs = [
  { path: '/admin', labelKey: 'admin_overview', icon: BarChart3 },
  { path: '/admin/users', labelKey: 'user_management', icon: Users },
  { path: '/admin/memberships', labelKey: 'membership_management', icon: CreditCard },
  { path: '/admin/permissions', labelKey: 'permission_management', icon: Shield },
  { path: '/admin/system', labelKey: 'system_settings', icon: Server },
  { path: '/admin/kline-data', labelKey: 'kline_data', icon: CandlestickChart },
]

export default function AdminLayout() {
  const location = useLocation()
  const { t } = useTranslation()

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
          <span className="text-lg font-bold glow-text-gold">{t.admin.admin_panel}</span>
        </div>
        <div className="ml-auto">
          <Link to="/dashboard" className="flex items-center gap-1.5 text-sm text-[#8888aa] hover:text-[#e0e0ff] transition-colors">
            <ArrowLeft size={14} /> {t.admin.back_to_front}
          </Link>
        </div>
      </div>

      <div className="pt-16 flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 min-h-[calc(100vh-4rem)] bg-dark-800/30 border-r border-[rgba(0,240,255,0.08)] py-4 px-3">
          <nav className="space-y-1">
            {adminLinkDefs.map((link) => (
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
                {t.admin[link.labelKey]}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)] overflow-auto flex flex-col">
          <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
          <footer className="border-t border-[rgba(0,240,255,0.08)] bg-dark-950">
            <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
              <div className="p-3 rounded-lg bg-gold/5 border border-gold/15 text-xs text-[#aaa89a] leading-relaxed text-center">
                <span className="text-gold font-medium">{t.admin.risk_warning_short}</span>{t.common.risk_warning.replace(t.admin.risk_warning_short, '')}
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
