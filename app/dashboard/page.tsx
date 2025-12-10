import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'
import SalesTrendChart from '@/components/SalesTrendChart'
import TopItemsChart from '@/components/TopItemsChart'
import DashboardStatsCards from '@/components/DashboardStatsCards'
import ProfitLossStatsCards from '@/components/ProfitLossStatsCards'
import ExpenseStatsCards from '@/components/ExpenseStatsCards'
import LowStockAlerts from '@/components/LowStockAlerts'
import StaffSalesRanking from '@/components/StaffSalesRanking'
import DashboardExportButton from '@/components/DashboardExportButton'

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
        <div className="mb-8 grid gap-2  place-items-start md:place-items-start md:flex items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">Overview of your inventory and sales performance</p>
          </div>
          <DashboardExportButton />
        </div>

        <DashboardStatsCards userRole={profile.role} />

        {/* Profit & Loss section - only visible to management roles (not staff) */}
        {['branch_manager', 'admin', 'tenant_admin'].includes(profile.role) && (
          <div className="mt-8">
            <ProfitLossStatsCards />
          </div>
        )}

        {/* Expenses - only visible to management roles (not staff) */}
        {['branch_manager', 'admin', 'tenant_admin', 'controller'].includes(profile.role) && (
          <div className="mt-8">
            <ExpenseStatsCards />
          </div>
        )}

        {/* Low Stock Alerts - only visible to management roles (not staff) */}
        {['branch_manager', 'admin', 'tenant_admin', 'controller'].includes(profile.role) && (
          <div className="mt-8">
            <LowStockAlerts />
          </div>
        )}

        {/* Staff Sales Ranking - visible to management roles and controllers (they issue items) */}
        {['branch_manager', 'admin', 'tenant_admin', 'controller'].includes(profile.role) && (
          <div className="mt-8">
            <StaffSalesRanking />
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesTrendChart />
          <TopItemsChart />
        </div>
      </div>
    </DashboardLayout>
  )
}
