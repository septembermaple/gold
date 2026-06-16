import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut, Settings, ChevronDown, BarChart3, TrendingUp, Building2, Lightbulb } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Avatar from '@radix-ui/react-avatar'
import Button from '../ui/Button'
import { cn } from '../../lib/utils'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = [
    { path: '/dashboard', label: '仪表盘', icon: BarChart3 },
    { path: '/analysis', label: 'AI分析', icon: TrendingUp },
    { path: '/institution-views', label: '机构观点', icon: Building2 },
    { path: '/investment-advice', label: '投资建议', icon: Lightbulb },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 glass-dark border-b border-[rgba(0,240,255,0.1)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-glow to-electric-blue flex items-center justify-center glow-border">
              <span className="text-dark-900 font-bold text-sm">Au</span>
            </div>
            <span className="text-lg font-bold glow-text hidden sm:block group-hover:text-cyan-glow transition-colors">
              GoldAI
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all duration-300',
                  isActive(link.path)
                    ? 'text-cyan-glow bg-cyan-glow/10 border border-cyan-glow/20'
                    : 'text-[#8888aa] hover:text-[#e0e0ff] hover:bg-white/5'
                )}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    <Avatar.Root className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-glow/30 to-electric-blue/30 border border-cyan-glow/20 flex items-center justify-center">
                      <Avatar.Fallback className="text-xs font-medium text-cyan-glow">
                        {user.username?.charAt(0).toUpperCase() || 'U'}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <span className="hidden sm:block text-sm text-[#e0e0ff]">{user.username}</span>
                    <ChevronDown size={14} className="text-[#8888aa]" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="glass-dark p-1 min-w-[180px] z-50"
                    sideOffset={5}
                    align="end"
                  >
                    <DropdownMenu.Item asChild>
                      <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-[#e0e0ff] hover:bg-white/5 rounded-md cursor-pointer outline-none">
                        <User size={14} /> 个人中心
                      </Link>
                    </DropdownMenu.Item>
                    {user.role === 'admin' && (
                      <DropdownMenu.Item asChild>
                        <Link to="/admin" className="flex items-center gap-2 px-3 py-2 text-sm text-[#e0e0ff] hover:bg-white/5 rounded-md cursor-pointer outline-none">
                          <Settings size={14} /> 管理后台
                        </Link>
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Separator className="h-px bg-[rgba(0,240,255,0.1)] my-1" />
                    <DropdownMenu.Item
                      className="flex items-center gap-2 px-3 py-2 text-sm text-neon-red hover:bg-neon-red/10 rounded-md cursor-pointer outline-none"
                      onClick={() => { logout(); navigate('/') }}
                    >
                      <LogOut size={14} /> 退出登录
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  登录
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
                  注册
                </Button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden text-[#8888aa] hover:text-[#e0e0ff] p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden glass-dark border-t border-[rgba(0,240,255,0.1)] animate-slide-down">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all',
                  isActive(link.path)
                    ? 'text-cyan-glow bg-cyan-glow/10'
                    : 'text-[#8888aa] hover:text-[#e0e0ff] hover:bg-white/5'
                )}
                onClick={() => setMobileOpen(false)}
              >
                <link.icon size={16} />
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
