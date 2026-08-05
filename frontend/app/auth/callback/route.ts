import { NextResponse, type NextRequest } from 'next/server'
import { getAuthCallbackDestination, getAuthCallbackOrigin } from '@/lib/authCallback'
import { createClient } from '@/lib/supabase/server'

function redirectToLogin(origin: string): NextResponse {
  const loginUrl = new URL('/login', origin)
  loginUrl.searchParams.set('error', 'oauth_callback')
  const response = NextResponse.redirect(loginUrl)
  response.cookies.set('post_login_redirect', '', { path: '/', maxAge: 0 })
  return response
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code')
  const origin = getAuthCallbackOrigin(request.url, process.env.NEXT_PUBLIC_APP_URL)
  const destination = getAuthCallbackDestination(
    request.nextUrl.searchParams.get('redirect'),
    request.cookies.get('post_login_redirect')?.value ?? null,
  )

  if (!code) {
    return redirectToLogin(origin)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return redirectToLogin(origin)
  }

  const response = NextResponse.redirect(new URL(destination, origin))
  response.cookies.set('post_login_redirect', '', { path: '/', maxAge: 0 })
  return response
}
