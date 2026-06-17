import { Server, Database, Cpu, HardDrive, Clock, Globe } from 'lucide-react'
import GlowCard from '../../components/ui/GlowCard'
import HolographicText from '../../components/ui/HolographicText'
import Badge from '../../components/ui/Badge'
import { useTranslation } from '../../contexts/LanguageContext'

export default function AdminSystem() {
  const t = useTranslation()

  const systemInfo = [
    { label: t.admin.system_version, value: 'v1.0.0', icon: Server },
    { label: t.admin.uptime, value: '15d 8h', icon: Clock },
    { label: t.admin.database_status, value: t.admin.running_normal, icon: Database },
    { label: t.admin.cpu_usage, value: '23%', icon: Cpu },
    { label: t.admin.memory_usage, value: '4.2 GB / 16 GB', icon: HardDrive },
    { label: t.admin.api_endpoint, value: 'https://api.goldai.com', icon: Globe },
  ]

  const services = [
    { name: t.admin.api_service, status: 'running', uptime: '99.9%' },
    { name: t.admin.database_service, status: 'running', uptime: '99.8%' },
    { name: t.admin.ai_engine, status: 'running', uptime: '99.5%' },
    { name: t.admin.push_service, status: 'running', uptime: '99.7%' },
    { name: t.admin.scheduled_tasks, status: 'running', uptime: '99.6%' },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#e0e0ff]">
          {t.admin.system_settings_part1}<HolographicText color="green">{t.admin.system_settings_part2}</HolographicText>
        </h1>
        <p className="text-sm text-[#8888aa] mt-1">{t.admin.system_settings_desc}</p>
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
          <h3 className="text-base font-semibold text-[#e0e0ff]">{t.admin.service_status}</h3>
        </div>
        <div className="space-y-3">
          {services.map((service) => (
            <div key={service.name} className="flex items-center justify-between py-2 border-b border-[rgba(0,240,255,0.05)] last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                <span className="text-sm text-[#e0e0ff]">{service.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="green" size="sm">{t.admin.running}</Badge>
                <span className="text-xs text-[#8888aa] font-mono">{t.admin.availability} {service.uptime}</span>
              </div>
            </div>
          ))}
        </div>
      </GlowCard>

      {/* Environment Variables */}
      <GlowCard color="gold">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-gold" />
          <h3 className="text-base font-semibold text-[#e0e0ff]">{t.admin.env_config}</h3>
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
