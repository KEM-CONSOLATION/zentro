import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import AdminDashboard from '@/components/AdminDashboard'

export default async function AdminPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    await supabase.auth.signOut()
    redirect('/login?error=unauthorized')
  }

  if (profile.role !== 'admin' && profile.role !== 'superadmin') {
    redirect('/dashboard')
  }

  return (
    <DashboardLayout user={profile}>
      <div>
        <AdminDashboard />
      </div>
    </DashboardLayout>
  )
}

