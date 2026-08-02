import { NextResponse, type NextRequest } from 'next/server'
import { getSafeAuthRedirect } from '@/lib/authRedirect'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code')
  const destination = getSafeAuthRedirect(request.nextUrl.searchParams.get('redirect'))

  if (!code) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'oauth_callback')
    return NextResponse.redirect(loginUrl)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'oauth_callback')
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.redirect(new URL(destination, request.url))
}
