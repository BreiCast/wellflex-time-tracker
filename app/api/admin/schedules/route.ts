import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { z } from 'zod'

const scheduleSchema = z.object({
  user_id: z.string().uuid(),
  team_id: z.string().uuid(),
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  is_active: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const admin = await getUserFromRequest(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_id')
    const userId = searchParams.get('user_id')

    if (!teamId || !userId) {
      return NextResponse.json(
        { error: 'team_id and user_id are required' },
        { status: 400 }
      )
    }

    const isSuperAdminUser = isSuperAdmin(admin)

    if (!isSuperAdminUser) {
      // Verify admin is manager/admin of the team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', admin.id)
        .single()

      if (!teamMember || !['MANAGER', 'ADMIN'].includes((teamMember as { role: string }).role)) {
        return NextResponse.json(
          { error: 'Only managers and admins can view team member schedules' },
          { status: 403 }
        )
      }
    }

    // Verify target user is member of the team
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single()

    if (!targetMember) {
      return NextResponse.json(
        { error: 'User is not a member of this team' },
        { status: 404 }
      )
    }

    // Get schedules for the target user
    const { data: schedules, error } = await supabase
      .from('schedules')
      .select('*, teams(id, name, color)')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .eq('is_active', true)
      .order('day_of_week, start_time')

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ schedules: schedules || [] })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getUserFromRequest(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    const body = await request.json()
    const schedule = scheduleSchema.parse(body)

    const isSuperAdminUser = isSuperAdmin(admin)

    if (!isSuperAdminUser) {
      // Verify admin is manager/admin of the team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', schedule.team_id)
        .eq('user_id', admin.id)
        .single()

      if (!teamMember || !['MANAGER', 'ADMIN'].includes((teamMember as { role: string }).role)) {
        return NextResponse.json(
          { error: 'Only managers and admins can manage team member schedules' },
          { status: 403 }
        )
      }
    }

    // Verify target user is member of the team
    const { data: targetMember } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', schedule.team_id)
      .eq('user_id', schedule.user_id)
      .single()

    if (!targetMember) {
      return NextResponse.json(
        { error: 'User is not a member of this team' },
        { status: 404 }
      )
    }

    // Upsert schedule
    const { data: createdSchedule, error } = await supabase
      .from('schedules')
      .upsert({
        user_id: schedule.user_id,
        team_id: schedule.team_id,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time,
        is_active: schedule.is_active ?? true,
        updated_at: new Date().toISOString(),
      } as any, {
        onConflict: 'user_id,team_id,day_of_week',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ schedule: createdSchedule })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getUserFromRequest(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createServiceSupabaseClient()
    const { searchParams } = new URL(request.url)
    const scheduleId = searchParams.get('id')

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      )
    }

    // Get schedule to verify permissions
    const { data: schedule, error: scheduleError } = await supabase
      .from('schedules')
      .select('team_id, user_id')
      .eq('id', scheduleId)
      .single()

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      )
    }

    const isSuperAdminUser = isSuperAdmin(admin)

    if (!isSuperAdminUser) {
      // Verify admin is manager/admin of the team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', (schedule as { team_id: string }).team_id)
        .eq('user_id', admin.id)
        .single()

      if (!teamMember || !['MANAGER', 'ADMIN'].includes((teamMember as { role: string }).role)) {
        return NextResponse.json(
          { error: 'Only managers and admins can delete team member schedules' },
          { status: 403 }
        )
      }
    }

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', scheduleId)

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: 'Schedule deleted successfully' })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
