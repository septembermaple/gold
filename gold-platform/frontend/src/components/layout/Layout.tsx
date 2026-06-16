import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Sidebar from './Sidebar'

interface LayoutProps {
  showSidebar?: boolean
  sidebarVariant?: 'main' | 'admin'
}

export default function Layout({ showSidebar = true, sidebarVariant = 'main' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-dark-900 grid-bg">
      <Navbar />
      <div className="pt-16 flex">
        {showSidebar && <Sidebar variant={sidebarVariant} />}
        <main className="flex-1 min-h-[calc(100vh-4rem)] overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
