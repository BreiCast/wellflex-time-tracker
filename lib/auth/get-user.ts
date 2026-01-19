import { createServiceSupabaseClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function getUserFromRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')
  const supabase = createServiceSupabaseClient()
  
  // Create a client with the user's token
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    return null
  }

  return user
}

