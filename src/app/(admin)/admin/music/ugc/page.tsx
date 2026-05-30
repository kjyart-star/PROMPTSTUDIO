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

  // 1. 관리자 권한 확인 (profiles 테이블에서 is_admin 검사)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profileData?.is_admin) {
    redirect('/')
  }

  return <UgcManagementClient />
}
