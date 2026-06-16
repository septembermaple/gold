import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // 只在非登录/注册页面才跳转到登录页，避免无限重定向
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  register: (data: { username: string; email: string; password: string }) =>
    api.post('/auth/register', data),
  login: (data: { email?: string; username?: string; password: string }) =>
    api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data: { username?: string; email?: string }) =>
    api.put('/auth/profile', data),
  changePassword: (data: { oldPassword: string; newPassword: string }) =>
    api.put('/auth/change-password', data),
}

export const goldApi = {
  getInternationalPrice: () => api.get('/gold/price/international'),
  getDomesticPrice: () => api.get('/gold/price/domestic'),
  getAllPrices: () => api.get('/gold/price/all'),
  getKline: (params?: { period?: string; count?: number }) =>
    api.get('/gold/kline', { params }),
  getChartKline: (params?: { period?: string; count?: number }) =>
    api.get('/gold/chart/kline', { params }),
  analyze: (data?: { question?: string }) => api.post('/gold/analyze', data),
  analyzeStream: (data?: { question?: string }) =>
    api.post('/gold/analyze/stream', data, { responseType: 'stream' }),
  getStats: () => api.get('/gold/stats'),
  getDollarRealtime: () => api.get('/gold/dollar-realtime'),
}

export const newsApi = {
  getNews: (params?: { page?: number; limit?: number }) =>
    api.get('/news', { params }),
  getLatestNews: (params?: { limit?: number }) =>
    api.get('/news/latest', { params }),
}

export const analysisApi = {
  getBullishFactors: () => api.get('/analysis/bullish-factors'),
  getBearishFactors: () => api.get('/analysis/bearish-factors'),
  getInstitutionViews: () => api.get('/analysis/institution-views'),
  getInvestmentAdvice: (params?: { level?: string }) =>
    api.get('/analysis/investment-advice', { params }),
  getMarketSummary: () => api.get('/analysis/market-summary'),
  refreshAnalysis: () => api.post('/analysis/refresh/all'),
}

export const macroApi = {
  getDashboard: () => api.get('/macro/dashboard'),
}

export const aiApi = {
  bullishAnalysis: () => api.post('/analysis/ai/bullish'),
  bearishAnalysis: () => api.post('/analysis/ai/bearish'),
  summaryAnalysis: () => api.post('/analysis/ai/summary'),
  adviceAnalysis: () => api.post('/analysis/ai/advice'),
}

export const pushApi = {
  testPush: (data: { message: string }) => api.post('/push/test', data),
  scheduledPush: (data: { cron: string; message: string }) =>
    api.post('/push/scheduled', data),
  forcePush: (data: { message: string }) => api.post('/push/force', data),
  getPushStatus: () => api.get('/push/status'),
  subscribe: (pushToken: string, pushType: string = 'daily') => api.post('/push/subscribe', { pushToken, pushType }),
  unsubscribe: () => api.post('/push/unsubscribe'),
  test: () => api.post('/push/test'),
}

export const adminApi = {
  getUsers: (params?: { page?: number; limit?: number; search?: string }) =>
    api.get('/admin/users', { params }),
  getUser: (id: string) => api.get(`/admin/users/${id}`),
  updateUser: (id: string, data: { username?: string; email?: string; role?: string; membershipLevel?: string; status?: string }) =>
    api.put(`/admin/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/admin/users/${id}`),
  getMemberships: () => api.get('/admin/memberships'),
  createMembership: (data: { name: string; level: string; price: number; features: string[]; apiLimit: number }) =>
    api.post('/admin/memberships', data),
  updateMembership: (id: string, data: { name?: string; level?: string; price?: number; features?: string[]; apiLimit?: number }) =>
    api.put(`/admin/memberships/${id}`, data),
  deleteMembership: (id: string) => api.delete(`/admin/memberships/${id}`),
  getPermissions: () => api.get('/admin/permissions'),
  createPermission: (data: { name: string; code: string; description: string }) =>
    api.post('/admin/permissions', data),
  updatePermission: (id: string, data: { name?: string; code?: string; description?: string }) =>
    api.put(`/admin/permissions/${id}`, data),
  updateRolePermissions: (role: string, permissionIds: string[]) =>
    api.put('/admin/role-permissions', { role, permission_ids: permissionIds }),
  getRolePermissions: (role: string) => api.get(`/admin/role-permissions/${role}`),
  getApiUsage: (params?: { page?: number; limit?: number }) =>
    api.get('/admin/api-usage', { params }),
  getAdminDashboard: () => api.get('/admin/dashboard'),
  loadKlineData: (startDate: string, period?: string) =>
    api.post('/gold/admin/kline/load', { startDate, period }),
  forceLoadKlineData: (startDate: string, endDate?: string, period?: string) =>
    api.post('/gold/admin/kline/load-force', { startDate, endDate, period }),
  getKlineStatus: () => api.get('/gold/admin/kline/status'),
}

export default api
