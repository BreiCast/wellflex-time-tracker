import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'

export async function GET(
  request: NextRequest,
  { params }: { params: { requestId: string } }
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
    const requestId = params.requestId

    // Get request with user and team info
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select(`
        *,
        users!requests_user_id_fkey(email, full_name),
        teams(id, name, color),
        reviewed_by_user:users!requests_reviewed_by_fkey(email, full_name)
      `)
      .eq('id', requestId)
      .single()

    if (requestError || !requestData) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    // Check permissions: user must be the requester, or a manager/admin of the team
    const isSuperAdminUser = isSuperAdmin(user)
    const isRequester = (requestData as any).user_id === user.id

    if (!isSuperAdminUser && !isRequester) {
      // Check if user is manager/admin of the team
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', (requestData as any).team_id)
        .eq('user_id', user.id)
        .single()

      if (!teamMember || !['MANAGER', 'ADMIN'].includes((teamMember as { role: string }).role)) {
        return NextResponse.json(
          { error: 'Unauthorized to view this request' },
          { status: 403 }
        )
      }
    }

    // Get comments with user info
    const { data: comments, error: commentsError } = await supabase
      .from('request_comments')
      .select(`
        *,
        users!request_comments_user_id_fkey(email, full_name)
      `)
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })

    if (commentsError) {
      console.error('Error fetching comments:', commentsError)
      // Don't fail the request if comments fail, just return empty array
    }

    return NextResponse.json({
      request: requestData,
      comments: comments || []
    })
  } catch (error: any) {
    console.error('Error fetching request:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
