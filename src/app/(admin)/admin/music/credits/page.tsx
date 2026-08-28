'use client'

import { useEffect, useState } from 'react'
import { Users, CreditCard, Plus, Minus, Loader2, AlertCircle, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string
  credits: number | null
  is_admin: boolean
  created_at: string
}

export default function AdminCreditsPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('')

  // Modal State
  const [creditModal, setCreditModal] = useState<{
    isOpen: boolean
    user: Profile
    amount: number
    mode: 'add' | 'sub'
  } | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data || [])
      } else {
        console.error('Failed to fetch users')
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleUpdateCredits = async () => {
    if (!creditModal) return
    const { user, amount, mode } = creditModal
    
    if (amount <= 0) {
      alert('0보다 큰 값을 입력해주세요.')
      return
    }

    const delta = mode === 'add' ? amount : -amount
    setActionLoading(user.id)
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetUserId: user.id,
          creditDelta: delta
        })
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, credits: updated.credits } : u))
        setCreditModal(null)
      } else {
        alert('크레딧 업데이트에 실패했습니다.')
      }
    } catch (err) {
      console.error(err)
      alert('오류가 발생했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredUsers = users.filter(u => 
    (u.display_name && u.display_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6 font-sans text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-primary" />
            크레딧 관리 (User Credits)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            전체 사용자의 보유 크레딧을 확인하고 지급하거나 차감합니다.
          </p>
        </div>
      </div>

      <div className="bg-[#161616] border border-[#232323] rounded-2xl p-6">
        <div className="flex items-center gap-2 bg-[#0a0a0a] border border-[#232323] rounded-xl px-4 py-2 mb-6">
          <Search className="w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="이름 또는 이메일로 검색..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-slate-500"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-slate-400 font-medium">사용자 데이터를 불러오는 중입니다...</span>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-[#232323] text-slate-400 uppercase text-xs tracking-wider">
                  <th className="px-4 py-3 font-semibold">사용자</th>
                  <th className="px-4 py-3 font-semibold">이메일</th>
                  <th className="px-4 py-3 font-semibold">권한</th>
                  <th className="px-4 py-3 font-semibold text-right">보유 크레딧</th>
                  <th className="px-4 py-3 font-semibold text-center">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232323]">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-[#0a0a0a] transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#232323] overflow-hidden shrink-0">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Users className="w-4 h-4 m-2 text-slate-400" />
                          )}
                        </div>
                        <span className="font-bold text-white">{user.display_name || '이름 없음'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-400">{user.email || '-'}</td>
                    <td className="px-4 py-4">
                      {user.is_admin ? (
                        <span className="px-2 py-1 bg-red-500/10 text-red-400 text-[10px] font-bold rounded">관리자</span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-800 text-slate-300 text-[10px] font-bold rounded">사용자</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-primary">
                      {(user.credits ?? 120).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          disabled={actionLoading === user.id}
                          onClick={() => setCreditModal({ isOpen: true, user, amount: 100, mode: 'add' })}
                          className="p-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors border border-primary/20"
                          title="크레딧 추가"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button 
                          disabled={actionLoading === user.id}
                          onClick={() => setCreditModal({ isOpen: true, user, amount: 100, mode: 'sub' })}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20"
                          title="크레딧 차감"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <AlertCircle className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="font-medium text-sm">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>

      {/* Credit Modal */}
      {creditModal && creditModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#161616] border border-[#232323] rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 pb-3 flex items-center gap-3">
              <CreditCard className="w-6 h-6 text-primary shrink-0" />
              <h3 className="text-lg font-bold text-white">크레딧 {creditModal.mode === 'add' ? '추가' : '차감'}</h3>
            </div>
            
            <div className="px-5 pb-5 space-y-4">
              <p className="text-sm text-slate-300">
                <span className="font-bold text-white">{creditModal.user.display_name}</span> 님에게 크레딧을 {creditModal.mode === 'add' ? '추가합니다' : '차감합니다'}.
              </p>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase text-slate-400">금액 입력</label>
                <input 
                  type="number" 
                  value={creditModal.amount}
                  onChange={(e) => setCreditModal({ ...creditModal, amount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-[#0a0a0a] border border-[#232323] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-primary/50"
                  min="1"
                />
              </div>
            </div>
            
            <div className="p-4 bg-[#0a0a0a] border-t border-[#232323] flex justify-end gap-2">
              <button 
                onClick={() => setCreditModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#161616] rounded-lg transition-all"
              >
                취소
              </button>
              <button 
                onClick={handleUpdateCredits}
                disabled={actionLoading === creditModal.user.id}
                className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all text-black ${
                  creditModal.mode === 'add' ? 'bg-primary hover:bg-[#e51d75]' : 'bg-red-500 hover:bg-red-600 text-white'
                }`}
              >
                {actionLoading === creditModal.user.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {creditModal.mode === 'add' ? '지급하기' : '차감하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
