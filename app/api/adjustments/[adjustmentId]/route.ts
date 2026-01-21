import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateAdjustmentSchema = z.object({
  adjustment_type: z.enum(['ADD_TIME', 'SUBTRACT_TIME', 'OVERRIDE']).optional(),
  minutes: z.number().int().optional(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { adjustmentId: string } }
) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    const { adjustmentId } = params
    const body = await request.json()
    const updateData = updateAdjustmentSchema.parse(body)

    // Get the adjustment to check permissions
    const { data: adjustment, error: fetchError } = await supabase
      .from('adjustments')
      .select('id, user_id, team_id, request_id')
      .eq('id', adjustmentId)
      .single()

    if (fetchError || !adjustment) {
      return NextResponse.json(
        { error: 'Adjustment not found' },
        { status: 404 }
      )
    }

    const isSuperAdminUser = isSuperAdmin(user)

    if (!isSuperAdminUser) {
      // Verify user is manager/admin of the team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', (adjustment as any).team_id)
        .eq('user_id', user.id)
        .single()

      if (!teamMember || !['MANAGER', 'ADMIN'].includes((teamMember as { role: string }).role)) {
        return NextResponse.json(
          { error: 'Only managers and admins can edit adjustments' },
          { status: 403 }
        )
      }
    }

    // Update the adjustment
    const { data: updatedAdjustment, error: updateError } = await supabase
      .from('adjustments')
      .update(updateData)
      .eq('id', adjustmentId)
      .select()
      .single()

    if (updateError) {
      console.error('[ADJUSTMENTS] Error updating adjustment:', {
        error: updateError,
        adjustmentId,
        updateData,
      })
      return NextResponse.json(
        { error: updateError.message || 'Failed to update adjustment' },
        { status: 400 }
      )
    }

    return NextResponse.json({ adjustment: updatedAdjustment })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[ADJUSTMENTS] Error in PATCH:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
