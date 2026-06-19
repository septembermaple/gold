import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, ProtectedRoute, AdminRoute } from './lib/auth.tsx'
import { GoldDataProvider } from './contexts/GoldDataContext'
import { Toaster } from 'sonner'
import Layout from './components/layout/Layout'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Analysis from './pages/Analysis'
import InstitutionViews from './pages/InstitutionViews'
import InvestmentAdvice from './pages/InvestmentAdvice'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminMemberships from './pages/admin/Memberships'
import AdminPermissions from './pages/admin/Permissions'
import AdminSystem from './pages/admin/System'
import AdminKlineData from './pages/admin/KlineData'
import MacroDashboard from './pages/MacroDashboard'
import SignalsPage from './pages/SignalsPage'
import SentimentPage from './pages/SentimentPage'
import ScoringPage from './pages/ScoringPage'
import RiskPage from './pages/RiskPage'
import AIAnalysisPage from './pages/AIAnalysisPage'
import EconomicCalendar from './pages/EconomicCalendar'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <GoldDataProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'rgba(13, 13, 43, 0.95)',
                border: '1px solid rgba(0, 240, 255, 0.15)',
                color: '#e0e0ff',
                backdropFilter: 'blur(12px)',
              },
            }}
          />
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/institution-views" element={<InstitutionViews />} />
              <Route path="/investment-advice" element={<InvestmentAdvice />} />
              <Route path="/profile" element={<Profile />} />

              {/* 宏观分析页面 */}
              <Route path="/macro" element={<MacroDashboard />} />
              <Route path="/signals" element={<SignalsPage />} />
              <Route path="/sentiment" element={<SentimentPage />} />
              <Route path="/scoring" element={<ScoringPage />} />
              <Route path="/risk" element={<RiskPage />} />
              <Route path="/ai-analysis" element={<AIAnalysisPage />} />
              <Route path="/calendar" element={<EconomicCalendar />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="memberships" element={<AdminMemberships />} />
              <Route path="permissions" element={<AdminPermissions />} />
              <Route path="system" element={<AdminSystem />} />
              <Route path="kline-data" element={<AdminKlineData />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </GoldDataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
