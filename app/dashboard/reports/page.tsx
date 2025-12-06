import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import SalesReports from '@/components/SalesReports'

export default async function ReportsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900">Sales Reports</h1>
          <p className="mt-2 text-gray-600">View daily, weekly, and monthly sales summaries</p>
        </div>

        <SalesReports />
      </div>
    </DashboardLayout>
  )
}

