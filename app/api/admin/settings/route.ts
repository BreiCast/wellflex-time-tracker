import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const settingsSchema = z.object({
  missed_punch_threshold_hours: z.number().int().min(1).max(24).optional(),
  clock_in_reminder_window_minutes: z.number().int().min(0).max(120).optional(),
  clock_out_reminder_before_minutes: z.number().int().min(0).max(120).optional(),
  clock_out_reminder_after_minutes: z.number().int().min(0).max(120).optional(),
  break_return_threshold_minutes: z.number().int().min(0).max(240).optional(),
  reminder_cooldown_minutes: z.number().int().min(0).max(240).optional(),
  quiet_hours_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
  quiet_hours_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle()

    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const serviceSupabase = createServiceSupabaseClient()
    const { data: settings, error } = await serviceSupabase
      .from('organization_settings' as any)
      .select('*')
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ settings })
  } catch (error: any) {
    console.error('[ADMIN-SETTINGS] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from('team_members')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('role', 'ADMIN')
      .limit(1)
      .maybeSingle()

    if (!adminCheck) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validated = settingsSchema.parse(body)

    const serviceSupabase = createServiceSupabaseClient()
    
    // Use transaction-like approach - update with current timestamp
    const { data: updated, error } = await serviceSupabase
      .from('organization_settings' as any)
      .update({
        ...validated,
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ settings: updated })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('[ADMIN-SETTINGS] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
