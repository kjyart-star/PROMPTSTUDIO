'use client'

import { useEffect, useState } from 'react'
import { Loader2, Shield, UserX, UserCheck, ShieldAlert, Search } from 'lucide-react'

interface UserProfile {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  handle: string | null
  bio: string | null
  is_banned: boolean
  is_admin: boolean
  created_at: string
}

export default function ArtistsPage() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // 회원 목록 가져오기
  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data || [])
      } else {
        throw new Error('회원 정보를 불러오지 못했습니다.')
      }
    } catch (err: any) {
      console.error('Error fetching users:', err)
      alert(err.message || '목록 로드 오류')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  // 사용자 정지/해제 토글
  const handleToggleUserBan = async (targetUserId: string, currentBanStatus: boolean) => {
    const actionLabel = currentBanStatus ? '정지 해제' : '계정 정지';
    const confirmMessage = currentBanStatus 
      ? `정말 이 사용자 계정을 ${actionLabel}하시겠습니까?\n정지 해제 시 서비스 이용 권한이 다시 활성화됩니다.`
      : `정말 이 사용자 계정을 ${actionLabel}하시겠습니까?\n계정 정지 시 이 사용자는 곡 생성이 차단되며, 공개한 모든 음원과 앨범이 즉시 일괄 비공개(UGC 목록에서 제외)로 강제 차단됩니다.`;

    if (!confirm(confirmMessage)) return

    setActionLoading(targetUserId)
    try {
      const res = await fetch(`/api/admin/users/ban`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId, is_banned: !currentBanStatus })
      })

      if (res.ok) {
        alert(`계정 ${actionLabel} 처리가 성공적으로 반영되었습니다.`)
        fetchUsers()
      } else {
        const err = await res.json()
        alert(`${actionLabel} 실패: ` + (err.error || '오류가 발생했습니다.'))
      }
    } catch (err) {
      console.error('Error toggling user ban:', err)
      alert('서버와의 통신에 실패했습니다.')
    } finally {
      setActionLoading(null)
    }
  }

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase()
    return (
      (u.display_name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.handle || '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6 font-sans select-none pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Shield className="w-6 h-6 text-[#e3fe06]" />
            아티스트 & 회원 관리
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            서비스 가입 회원 및 아티스트 프로필 목록입니다. 부적절한 사용자나 저작권 위반자의 계정을 정지 제재합니다.
          </p>
        </div>

        {/* 검색 바 */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="이름, 이메일, 핸들 검색" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#091009] border border-[#242c24] rounded-xl py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-[#e3fe06]/50 transition-colors"
          />
        </div>
      </div>

      {/* 리스트 테이블 (브랜드 테마: bg-[#161d16], border-[#242c24]) */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#e3fe06] animate-spin" />
        </div>
      ) : (
        <div className="bg-[#161d16] border border-[#242c24] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#242c24] bg-[#091009]/40 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-20">프로필</th>
                  <th className="py-4 px-6">이름 / 이메일</th>
                  <th className="py-4 px-6">핸들</th>
                  <th className="py-4 px-6">소개글</th>
                  <th className="py-4 px-6 w-28 text-center">권한 및 상태</th>
                  <th className="py-4 px-6 w-36">가입일</th>
                  <th className="py-4 px-6 w-32 text-right">제재 조치</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242c24]/60 text-sm">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className={`hover:bg-[#091009]/30 transition-all ${u.is_banned ? 'bg-red-950/10 border-l-2 border-l-red-500/50' : ''}`}>
                      <td className="py-4 px-6">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#091009] border border-[#242c24] flex items-center justify-center shrink-0">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-slate-400 text-xs font-bold font-mono">
                              {u.display_name?.slice(0, 2) || u.email?.slice(0, 2).toUpperCase() || 'U'}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 font-medium text-slate-100">
                        <div className="font-semibold text-slate-200">{u.display_name || '이름 없음'}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</div>
                      </td>
                      <td className="py-4 px-6 font-mono text-xs text-slate-400">
                        {u.handle ? `@${u.handle}` : '-'}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-400 truncate max-w-xs" title={u.bio || ''}>
                        {u.bio || '-'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex flex-col gap-1 items-center">
                          {u.is_admin ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#e3fe06]/10 text-[#e3fe06] border-[#e3fe06]/20">
                              관리자
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#242c24] text-slate-400 border-[#242c24]">
                              일반 회원
                            </span>
                          )}
                          
                          {u.is_banned && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/20 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              정지됨
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-slate-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {!u.is_admin && (
                          <button
                            id={`btn-ban-user-${u.id}`}
                            disabled={actionLoading === u.id}
                            onClick={() => handleToggleUserBan(u.id, u.is_banned)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                              u.is_banned 
                                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {actionLoading === u.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : u.is_banned ? (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                정지 해제
                              </>
                            ) : (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                계정 정지
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      검색 결과와 일치하는 회원이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
