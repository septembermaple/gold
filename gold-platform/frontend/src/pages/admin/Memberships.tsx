import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, RefreshCw, CreditCard } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import GlowCard from '../../components/ui/GlowCard'
import HolographicText from '../../components/ui/HolographicText'
import { adminApi } from '../../lib/api'
import { ensureArray, extractApiData } from '../../lib/utils'
import { toast } from 'sonner'
import { useTranslation } from '../../contexts/LanguageContext'

interface MembershipItem {
  id: string
  name: string
  level: string
  price: number
  features: string[]
  apiLimit: number
}

export default function AdminMemberships() {
  const { t } = useTranslation()
  const [memberships, setMemberships] = useState<MembershipItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editItem, setEditItem] = useState<MembershipItem | null>(null)
  const [form, setForm] = useState({ name: '', level: '', price: 0, features: '', apiLimit: 100 })

  useEffect(() => {
    loadMemberships()
  }, [])

  const loadMemberships = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getMemberships()
      const payload = extractApiData(res)
      const list = ensureArray<any>(payload.list || payload.memberships || payload)
      const mapped = list.map((m: any) => ({
        id: String(m.id),
        name: m.name || '',
        level: m.code || m.level || '',
        price: m.price_monthly || m.price || 0,
        features: typeof m.features === 'string' ? JSON.parse(m.features || '[]') : (m.features || []),
        apiLimit: m.max_api_calls_per_day || m.apiLimit || 0,
      }))
      setMemberships(mapped)
    } catch {
      toast.error(t.admin.get_memberships_failed)
      setMemberships([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditItem(null)
    setForm({ name: '', level: '', price: 0, features: '', apiLimit: 100 })
    setModal(true)
  }

  const handleEdit = (item: MembershipItem) => {
    setEditItem(item)
    setForm({
      name: item.name,
      level: item.level,
      price: item.price,
      features: item.features.join(', '),
      apiLimit: item.apiLimit,
    })
    setModal(true)
  }

  const handleSave = async () => {
    try {
      const data = {
        ...form,
        features: form.features.split(',').map(f => f.trim()).filter(Boolean),
      }
      if (editItem) {
        await adminApi.updateMembership(editItem.id, data)
        toast.success(t.admin.membership_update_success)
      } else {
        await adminApi.createMembership(data as never)
        toast.success(t.admin.membership_create_success)
      }
      setModal(false)
      loadMemberships()
    } catch {
      toast.error(t.admin.operation_failed)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t.admin.membership_delete_confirm)) return
    try {
      await adminApi.deleteMembership(id)
      toast.success(t.admin.membership_delete_success)
      loadMemberships()
    } catch {
      toast.error(t.admin.delete_failed)
    }
  }

  const levelColors: Record<string, 'cyan' | 'gold' | 'blue' | 'green'> = {
    free: 'cyan', basic: 'gold', pro: 'blue', enterprise: 'green',
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            {t.admin.membership_label}<HolographicText color="gold">{t.admin.management}</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">{t.admin.manage_membership}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadMemberships}>
            <RefreshCw size={14} />
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <Plus size={14} /> {t.admin.new_level}
          </Button>
        </div>
      </div>

      {/* Membership Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-[#8888aa]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold mx-auto mb-3" />
            {t.common.loading}
          </div>
        ) : memberships.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-[#8888aa]">{t.admin.no_membership_data}</div>
        ) : (
          memberships.map((item) => (
          <GlowCard key={item.id} color={levelColors[item.level] || 'cyan'}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard size={18} className={
                    levelColors[item.level] === 'cyan' ? 'text-cyan-glow' :
                    levelColors[item.level] === 'gold' ? 'text-gold' :
                    levelColors[item.level] === 'blue' ? 'text-electric-blue' :
                    'text-neon-green'
                  } />
                  <h3 className="text-lg font-semibold text-[#e0e0ff]">{item.name}</h3>
                </div>
                <Badge variant={levelColors[item.level] || 'cyan'}>{item.level.toUpperCase()}</Badge>
              </div>
              <div className="text-right">
                <p className="text-2xl font-mono font-bold text-[#e0e0ff]">¥{item.price}</p>
                <p className="text-xs text-[#8888aa]">{t.admin.per_month}</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {item.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-[#e0e0ff]">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    levelColors[item.level] === 'cyan' ? 'bg-cyan-glow' :
                    levelColors[item.level] === 'gold' ? 'bg-gold' :
                    levelColors[item.level] === 'blue' ? 'bg-electric-blue' :
                    'bg-neon-green'
                  }`} />
                  {feature}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[rgba(0,240,255,0.1)]">
              <span className="text-xs text-[#8888aa]">{t.admin.api_limit_format.replace('{count}', String(item.apiLimit))}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => handleEdit(item)} className="p-1.5 rounded-md hover:bg-cyan-glow/10 text-[#8888aa] hover:text-cyan-glow transition-colors">
                  <Edit size={14} />
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-md hover:bg-neon-red/10 text-[#8888aa] hover:text-neon-red transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </GlowCard>
        ))
        )}
      </div>

      {/* Modal */}
      <Modal open={modal} onOpenChange={setModal} title={editItem ? t.admin.edit_membership : t.admin.new_membership}>
        <div className="space-y-4">
          <Input label={t.admin.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t.admin.level_identifier} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="e.g. basic, pro" />
          <Input label={t.admin.price_per_month} type="number" value={String(form.price)} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          <Input label={t.admin.api_limit_per_day} type="number" value={String(form.apiLimit)} onChange={(e) => setForm({ ...form, apiLimit: Number(e.target.value) })} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#8888aa]">{t.admin.features_comma}</label>
            <textarea
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              placeholder="Real-time quotes, AI analysis, Bull/Bear factors"
              className="w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-sm text-[#e0e0ff] placeholder-[#8888aa]/50 focus:outline-none focus:border-cyan-glow/50 min-h-[80px] resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setModal(false)}>{t.common.cancel}</Button>
            <Button variant="primary" size="sm" onClick={handleSave}>{t.admin.save}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
