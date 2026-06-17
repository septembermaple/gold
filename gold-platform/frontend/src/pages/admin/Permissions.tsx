import { useState, useEffect, useCallback } from 'react'
import { Shield, Check, X, Save } from 'lucide-react'
import Button from '../../components/ui/Button'
import GlowCard from '../../components/ui/GlowCard'
import HolographicText from '../../components/ui/HolographicText'
import Badge from '../../components/ui/Badge'
import { toast } from 'sonner'
import { adminApi } from '../../lib/api'
import { extractApiData, ensureArray } from '../../lib/utils'
import { useTranslation } from '../../contexts/LanguageContext'

interface Permission {
  id: number
  name: string
  code: string
  description: string
  module?: string
}

interface RolePermissions {
  [role: string]: string[]
}

export default function AdminPermissions() {
  const { t } = useTranslation()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const roles = ['free', 'basic', 'pro', 'enterprise', 'admin']
  const roleColors: Record<string, 'cyan' | 'gold' | 'blue' | 'green' | 'red'> = {
    free: 'cyan', basic: 'gold', pro: 'blue', enterprise: 'green', admin: 'red',
  }

  const loadPermissions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getPermissions()
      const data = extractApiData(res)
      setPermissions(ensureArray(data) as Permission[])
    } catch {
      toast.error(t.admin.get_permissions_failed)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRolePermissions = useCallback(async () => {
    try {
      const rp: RolePermissions = {}
      for (const role of roles) {
        try {
          const res = await adminApi.getRolePermissions(role)
          const data = extractApiData(res)
          const perms = ensureArray(data) as Permission[]
          rp[role] = perms.map((p: Permission) => String(p.id))
        } catch {
          rp[role] = []
        }
      }
      setRolePermissions(rp)
    } catch {
      toast.error(t.admin.get_role_permissions_failed)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadPermissions(), loadRolePermissions()])
  }, [])

  const togglePermission = (role: string, permissionId: string) => {
    setRolePermissions(prev => {
      const current = prev[role] || []
      const updated = current.includes(permissionId)
        ? current.filter(id => id !== permissionId)
        : [...current, permissionId]
      return { ...prev, [role]: updated }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const role of roles) {
        await adminApi.updateRolePermissions(role, rolePermissions[role] || [])
      }
      toast.success(t.admin.permission_save_success)
    } catch {
      toast.error(t.admin.permission_save_failed)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-electric-blue border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            {t.admin.permission}<HolographicText color="blue">{t.admin.management}</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{t.admin.configure_permissions}</p>
        </div>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? t.admin.saving : t.admin.save_config}
        </Button>
      </div>

      {/* Permission Matrix */}
      {permissions.length > 0 ? (
        <GlowCard color="blue" className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(0,240,255,0.1)]">
                  <th className="text-left text-xs font-medium text-[#8888aa] px-5 py-3 min-w-[200px]">{t.admin.permission}</th>
                  {roles.map(role => (
                    <th key={role} className="text-center text-xs font-medium px-3 py-3 min-w-[90px]">
                      <Badge variant={roleColors[role]} size="sm">{role.toUpperCase()}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map(permission => (
                  <tr key={permission.id} className="border-b border-[rgba(0,240,255,0.05)] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="text-sm text-[#e0e0ff] font-medium">{permission.name}</p>
                        <p className="text-xs text-[#8888aa]">{permission.code}</p>
                      </div>
                    </td>
                    {roles.map(role => {
                      const hasPermission = (rolePermissions[role] || []).includes(String(permission.id))
                      return (
                        <td key={role} className="text-center px-3 py-3">
                          <button
                            onClick={() => togglePermission(role, String(permission.id))}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                              hasPermission
                                ? 'bg-neon-green/10 text-neon-green border border-neon-green/20'
                                : 'bg-dark-700/50 text-[#8888aa] border border-[rgba(0,240,255,0.05)]'
                            }`}
                          >
                            {hasPermission ? <Check size={14} /> : <X size={14} />}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlowCard>
      ) : (
        <GlowCard color="blue">
          <div className="text-center py-8">
            <Shield size={32} className="mx-auto text-[#8888aa] mb-2" />
            <p className="text-[#8888aa]">{t.admin.no_permission_data}</p>
          </div>
        </GlowCard>
      )}
    </div>
  )
}
