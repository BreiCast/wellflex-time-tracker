import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { getUserFromRequest } from '@/lib/auth/get-user'
import { isSuperAdmin } from '@/lib/auth/superadmin'
import { z } from 'zod'

const addCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment is too long'),
})

export async function POST(
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
    const body = await request.json()
    const { content } = addCommentSchema.parse(body)

    // Get request to check permissions
    const { data: requestData, error: requestError } = await supabase
      .from('requests')
      .select('id, user_id, team_id')
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
          { error: 'Unauthorized to comment on this request' },
          { status: 403 }
        )
      }
    }

    // Insert comment
    const { data: newComment, error: commentError } = await supabase
      .from('request_comments' as any)
      .insert({
        request_id: requestId,
        user_id: user.id,
        content,
        created_by: user.id,
      } as any)
      .select(`
        *,
        users(id, email, full_name)
      `)
      .single()

    if (commentError) {
      console.error('Error creating comment:', {
        error: commentError,
        message: commentError.message,
        details: commentError.details,
        hint: commentError.hint,
        code: commentError.code,
      })
      return NextResponse.json(
        { 
          error: 'Failed to add comment', 
          details: commentError.message || 'Unknown error',
          hint: commentError.hint || 'Check if request_comments table exists and RLS policies are correct'
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ comment: newComment })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error adding comment:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
