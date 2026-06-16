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

interface MembershipItem {
  id: string
  name: string
  level: string
  price: number
  features: string[]
  apiLimit: number
}

export default function AdminMemberships() {
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
      toast.error('获取会员等级失败')
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
        toast.success('会员等级更新成功')
      } else {
        await adminApi.createMembership(data as never)
        toast.success('会员等级创建成功')
      }
      setModal(false)
      loadMemberships()
    } catch {
      toast.error('操作失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此会员等级吗？')) return
    try {
      await adminApi.deleteMembership(id)
      toast.success('会员等级已删除')
      loadMemberships()
    } catch {
      toast.error('删除失败')
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
            会员<HolographicText color="gold">管理</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">管理会员等级与功能权限</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadMemberships}>
            <RefreshCw size={14} />
          </Button>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            <Plus size={14} /> 新增等级
          </Button>
        </div>
      </div>

      {/* Membership Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-[#8888aa]">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gold/20 border-t-gold mx-auto mb-3" />
            加载中...
          </div>
        ) : memberships.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-[#8888aa]">暂无会员等级数据</div>
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
                <p className="text-xs text-[#8888aa]">/月</p>
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
              <span className="text-xs text-[#8888aa]">API限制: {item.apiLimit}次/天</span>
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
      <Modal open={modal} onOpenChange={setModal} title={editItem ? '编辑会员等级' : '新增会员等级'}>
        <div className="space-y-4">
          <Input label="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="等级标识" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="如: basic, pro" />
          <Input label="价格（元/月）" type="number" value={String(form.price)} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
          <Input label="API限制（次/天）" type="number" value={String(form.apiLimit)} onChange={(e) => setForm({ ...form, apiLimit: Number(e.target.value) })} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#8888aa]">功能特性（逗号分隔）</label>
            <textarea
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              placeholder="实时行情, AI分析, 看涨看跌因子"
              className="w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-sm text-[#e0e0ff] placeholder-[#8888aa]/50 focus:outline-none focus:border-cyan-glow/50 min-h-[80px] resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setModal(false)}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleSave}>保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
