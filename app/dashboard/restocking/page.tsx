import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import RestockingForm from '@/components/RestockingForm'

export default async function RestockingPage() {
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

  // Staff cannot access restocking page - only managers and admins can
  if (profile.role === 'staff') {
    redirect('/dashboard?error=restocking_restricted')
  }

  return (
    <DashboardLayout user={profile}>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Restocking</h1>
          <p className="mt-2 text-gray-600">
            Add quantity to items. This will be added to the opening stock for calculations.
          </p>
        </div>

        <RestockingForm />
      </div>
    </DashboardLayout>
  )
}
