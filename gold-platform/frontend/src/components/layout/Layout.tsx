import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

interface LayoutProps {
  showSidebar?: boolean
  sidebarVariant?: 'main' | 'admin'
}

export default function Layout({ showSidebar = true, sidebarVariant = 'main' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-dark-900 grid-bg flex flex-col">
      <Navbar />
      <div className="flex-1 pt-16 flex">
        {showSidebar && <Sidebar variant={sidebarVariant} />}
        <main className="flex-1 min-h-[calc(100vh-4rem)] overflow-auto flex flex-col">
          <div className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
          <footer className="border-t border-[rgba(0,240,255,0.08)] bg-dark-950">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="p-3 rounded-lg bg-gold/5 border border-gold/15 text-xs text-[#aaa89a] leading-relaxed text-center">
                <span className="text-gold font-medium">风险提示：</span>本平台提供的数据分析与AI解读仅供学习参考，不构成任何投资建议。金融市场存在较大风险，投资需谨慎，请根据自身情况独立判断并承担相应风险。
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
