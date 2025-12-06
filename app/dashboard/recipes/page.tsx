import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import RecipeManagement from '@/components/RecipeManagement'

export default async function RecipesPage() {
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
        <RecipeManagement />
      </div>
    </DashboardLayout>
  )
}

