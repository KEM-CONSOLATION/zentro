import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import HistoryView from '@/components/HistoryView'

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profileError) {
    await supabase.auth.signOut()
    redirect('/login?error=unauthorized')
  }

  // Superadmins should only access admin page
  if (profile.role === 'superadmin') {
    redirect('/admin')
  }

  return (
    <DashboardLayout user={profile}>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">History</h1>
          <p className="mt-2 text-gray-600">View past records of opening stocks, closing stocks, and sales</p>
        </div>

        <HistoryView />
      </div>
    </DashboardLayout>
  )
}

