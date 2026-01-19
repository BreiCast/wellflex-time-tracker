import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const supabase = createServiceSupabaseClient()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    // Ensure user record exists
    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('id', data.user.id)
      .single()

    if (!userData) {
      await supabase.from('users').insert({
        id: data.user.id,
        email: data.user.email!,
        full_name: data.user.user_metadata?.full_name || null,
      })
    }

    return NextResponse.json({ user: data.user, session: data.session })
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

