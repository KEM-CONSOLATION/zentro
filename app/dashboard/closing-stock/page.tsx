import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardLayout from '@/components/DashboardLayout'
import DailyStockReport from '@/components/DailyStockReport'

export default async function ClosingStockPage() {
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

  return (
    <DashboardLayout user={profile}>
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Closing Stock</h1>
          <p className="mt-2 text-gray-600">Automatically calculated and saved: Opening Stock + Restocking - Sales. Manual entry available for past dates.</p>
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              <strong>✓ Automatic:</strong> Closing stock is automatically calculated and saved. These values will automatically become tomorrow's opening stock.
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>📝 Past Dates:</strong> Select a past date to manually enter closing stock values for historical records.
            </p>
          </div>
        </div>

        <DailyStockReport type="closing" />
      </div>
    </DashboardLayout>
  )
}

