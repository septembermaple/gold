import { useState, useEffect } from 'react'
import { Search, Edit, Trash2, UserPlus, RefreshCw } from 'lucide-react'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import GlowCard from '../../components/ui/GlowCard'
import HolographicText from '../../components/ui/HolographicText'
import { adminApi } from '../../lib/api'
import { formatDate, ensureArray, extractApiData } from '../../lib/utils'
import { toast } from 'sonner'

interface UserItem {
  id: string
  username: string
  email: string
  role: string
  membershipLevel: string
  status: string
  createdAt: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editModal, setEditModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null)
  const [editForm, setEditForm] = useState({ username: '', email: '', role: '', membershipLevel: '', status: '' })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getUsers({ search })
      const payload = extractApiData(res)
      // 后端返回 { list: [...], pagination: {...} }，字段名用下划线
      const rawUsers = ensureArray<any>(payload.list || payload.users)
      // 转换下划线字段为驼峰
      const mapped = rawUsers.map((u: any) => ({
        id: String(u.id),
        username: u.username || '',
        email: u.email || '',
        role: u.role || 'user',
        membershipLevel: u.membership_level || u.membershipLevel || 'free',
        status: u.status || 'active',
        createdAt: u.created_at || u.createdAt || '',
      }))
      setUsers(mapped)
    } catch {
      toast.error('获取用户列表失败')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: UserItem) => {
    setSelectedUser(user)
    setEditForm({
      username: user.username,
      email: user.email,
      role: user.role,
      membershipLevel: user.membershipLevel,
      status: user.status,
    })
    setEditModal(true)
  }

  const handleSave = async () => {
    if (!selectedUser) return
    try {
      // 转换驼峰为下划线以匹配后端
      await adminApi.updateUser(selectedUser.id, {
        username: editForm.username,
        email: editForm.email,
        role: editForm.role,
        membershipLevel: editForm.membershipLevel,
        status: editForm.status,
      })
      toast.success('用户信息更新成功')
      setEditModal(false)
      loadUsers()
    } catch {
      toast.error('更新失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此用户吗？')) return
    try {
      await adminApi.deleteUser(id)
      toast.success('用户已删除')
      loadUsers()
    } catch {
      toast.error('删除失败')
    }
  }

  const getStatusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="green">活跃</Badge>
    if (status === 'inactive') return <Badge variant="gray">未激活</Badge>
    if (status === 'banned') return <Badge variant="red">封禁</Badge>
    return <Badge variant="gray">{status}</Badge>
  }

  const getMembershipBadge = (level: string) => {
    const variants: Record<string, 'cyan' | 'gold' | 'blue' | 'green'> = {
      free: 'cyan', basic: 'gold', pro: 'blue', enterprise: 'green',
    }
    return <Badge variant={variants[level] || 'gray'}>{level.toUpperCase()}</Badge>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e0e0ff]">
            用户<HolographicText color="cyan">管理</HolographicText>
          </h1>
          <p className="text-sm text-[#8888aa] mt-1">管理系统用户、角色与会员等级</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8888aa]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              placeholder="搜索用户..."
              className="bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg pl-9 pr-4 py-2 text-sm text-[#e0e0ff] placeholder-[#8888aa]/50 focus:outline-none focus:border-cyan-glow/50 w-64"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={loadUsers}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <GlowCard color="cyan" className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(0,240,255,0.1)]">
                <th className="text-left text-xs font-medium text-[#8888aa] px-5 py-3">用户名</th>
                <th className="text-left text-xs font-medium text-[#8888aa] px-5 py-3">邮箱</th>
                <th className="text-left text-xs font-medium text-[#8888aa] px-5 py-3">角色</th>
                <th className="text-left text-xs font-medium text-[#8888aa] px-5 py-3">会员等级</th>
                <th className="text-left text-xs font-medium text-[#8888aa] px-5 py-3">状态</th>
                <th className="text-left text-xs font-medium text-[#8888aa] px-5 py-3">注册时间</th>
                <th className="text-right text-xs font-medium text-[#8888aa] px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#8888aa]">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-cyan-glow/20 border-t-cyan-glow mx-auto mb-3" />
                    加载中...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#8888aa]">暂无用户数据</td>
                </tr>
              ) : (
                users.map((user) => (
                <tr key={user.id} className="border-b border-[rgba(0,240,255,0.05)] hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-sm text-[#e0e0ff] font-medium">{user.username}</td>
                  <td className="px-5 py-3 text-sm text-[#8888aa]">{user.email}</td>
                  <td className="px-5 py-3">
                    <Badge variant={user.role === 'admin' ? 'gold' : 'gray'} size="sm">
                      {user.role === 'admin' ? '管理员' : '用户'}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">{getMembershipBadge(user.membershipLevel)}</td>
                  <td className="px-5 py-3">{getStatusBadge(user.status)}</td>
                  <td className="px-5 py-3 text-sm text-[#8888aa]">{formatDate(user.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-1.5 rounded-md hover:bg-cyan-glow/10 text-[#8888aa] hover:text-cyan-glow transition-colors"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-1.5 rounded-md hover:bg-neon-red/10 text-[#8888aa] hover:text-neon-red transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>
      </GlowCard>

      {/* Edit Modal */}
      <Modal open={editModal} onOpenChange={setEditModal} title="编辑用户">
        <div className="space-y-4">
          <Input label="用户名" value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} />
          <Input label="邮箱" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#8888aa]">角色</label>
            <select
              value={editForm.role}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              className="w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-sm text-[#e0e0ff] focus:outline-none focus:border-cyan-glow/50"
            >
              <option value="user">用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#8888aa]">会员等级</label>
            <select
              value={editForm.membershipLevel}
              onChange={(e) => setEditForm({ ...editForm, membershipLevel: e.target.value })}
              className="w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-sm text-[#e0e0ff] focus:outline-none focus:border-cyan-glow/50"
            >
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#8888aa]">状态</label>
            <select
              value={editForm.status}
              onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              className="w-full bg-dark-800/50 border border-[rgba(0,240,255,0.15)] rounded-lg px-4 py-2.5 text-sm text-[#e0e0ff] focus:outline-none focus:border-cyan-glow/50"
            >
              <option value="active">活跃</option>
              <option value="inactive">未激活</option>
              <option value="banned">封禁</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setEditModal(false)}>取消</Button>
            <Button variant="primary" size="sm" onClick={handleSave}>保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
