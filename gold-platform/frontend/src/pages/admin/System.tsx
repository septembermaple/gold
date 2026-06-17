import { Server, Database, Cpu, HardDrive, Clock, Globe } from 'lucide-react'
import GlowCard from '../../components/ui/GlowCard'
import HolographicText from '../../components/ui/HolographicText'
import Badge from '../../components/ui/Badge'

export default function AdminSystem() {
  const systemInfo = [
    { label: '系统版本', value: 'v1.0.0', icon: Server },
    { label: '运行时间', value: '15天 8小时', icon: Clock },
    { label: '数据库状态', value: '正常运行', icon: Database },
    { label: 'CPU使用率', value: '23%', icon: Cpu },
    { label: '内存使用', value: '4.2 GB / 16 GB', icon: HardDrive },
    { label: 'API端点', value: 'https://api.goldai.com', icon: Globe },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#e0e0ff]">
          系统<HolographicText color="green">设置</HolographicText>
        </h1>
        <p className="text-sm text-[#8888aa] mt-1">查看系统运行状态与配置信息</p>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {systemInfo.map((item) => (
          <GlowCard key={item.label} color="green">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-neon-green/10 flex items-center justify-center">
                <item.icon size={20} className="text-neon-green" />
              </div>
              <div>
                <p className="text-xs text-[#8888aa]">{item.label}</p>
                <p className="text-sm font-medium text-[#e0e0ff]">{item.value}</p>
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      {/* Service Status */}
      <GlowCard color="cyan">
        <div className="flex items-center gap-2 mb-4">
          <Server size={18} className="text-cyan-glow" />
          <h3 className="text-base font-semibold text-[#e0e0ff]">服务状态</h3>
        </div>
        <div className="space-y-3">
          {[
            { name: 'API 服务', status: 'running', uptime: '99.9%' },
            { name: '数据库服务', status: 'running', uptime: '99.8%' },
            { name: 'AI 分析引擎', status: 'running', uptime: '99.5%' },
            { name: '推送服务', status: 'running', uptime: '99.7%' },
            { name: '定时任务', status: 'running', uptime: '99.6%' },
          ].map((service) => (
            <div key={service.name} className="flex items-center justify-between py-2 border-b border-[rgba(0,240,255,0.05)] last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                <span className="text-sm text-[#e0e0ff]">{service.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="green" size="sm">运行中</Badge>
                <span className="text-xs text-[#8888aa] font-mono">可用率 {service.uptime}</span>
              </div>
            </div>
          ))}
        </div>
      </GlowCard>

      {/* Environment Variables */}
      <GlowCard color="gold">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-gold" />
          <h3 className="text-base font-semibold text-[#e0e0ff]">环境配置</h3>
        </div>
        <div className="space-y-2">
          {[
            { key: 'NODE_ENV', value: 'production' },
            { key: 'API_BASE_URL', value: 'https://api.aumind.cc' },
            { key: 'DB_HOST', value: '***.***.***.***' },
            { key: 'REDIS_URL', value: '***.***.***.***:6379' },
            { key: 'AI_MODEL', value: 'gpt-4-turbo' },
          ].map((env) => (
            <div key={env.key} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-cyan-glow font-mono">{env.key}</span>
              <span className="text-sm text-[#8888aa] font-mono">{env.value}</span>
            </div>
          ))}
        </div>
      </GlowCard>
    </div>
  )
}
