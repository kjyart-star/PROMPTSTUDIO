import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UgcManagementClient } from '@/components/admin/UgcManagementClient'

export const revalidate = 0

export default async function UgcManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. 관리자 권한 확인 (user_roles 테이블에서 역할 검사)
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (roleData?.role !== 'admin') {
    redirect('/')
  }

  return <UgcManagementClient />
}
