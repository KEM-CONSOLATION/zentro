import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'
import ProfitLossView from '@/components/ProfitLossView'
import ExpensesForm from '@/components/ExpensesForm'
import SalesTrendChart from '@/components/SalesTrendChart'
import TopItemsChart from '@/components/TopItemsChart'
import DashboardStatsCards from '@/components/DashboardStatsCards'
import LowStockAlerts from '@/components/LowStockAlerts'

export default async function DashboardPage() {
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

  // Superadmins should only access the admin page
  if (profile.role === 'superadmin') {
    redirect('/admin')
  }

  return (
    <DashboardLayout user={profile}>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Overview of your inventory and sales performance</p>
        </div>

        <DashboardStatsCards />

        <div className="mt-8">
          <LowStockAlerts />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesTrendChart />
          <TopItemsChart />
        </div>

        <div className="mt-8">
          <ProfitLossView />
        </div>

        <div className="mt-8">
          <ExpensesForm />
        </div>
      </div>
    </DashboardLayout>
  )
}

