import { NextRequest, NextResponse } from 'next/server'
import { cascadeUpdateFromDate } from '@/lib/stock-cascade'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { start_date, user_id, branch_id } = body

    if (!start_date || !user_id) {
      return NextResponse.json({ error: 'Missing start_date or user_id' }, { status: 400 })
    }

    const result = await cascadeUpdateFromDate(start_date, user_id, branch_id)

    return NextResponse.json({
      success: true,
      message: 'Cascade update completed',
      updates: result.updates,
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to cascade update'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
