import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getSafeAuthRedirect } from '@/lib/authRedirect'
import { isAllowedUserEmail } from '@/lib/access'

const PUBLIC_PATHS = ['/login', '/auth/callback']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function getProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null

  try {
    return new URL(url).hostname.split('.')[0] ?? null
  } catch {
    return null
  }
}

function hasAuthCookie(request: NextRequest): boolean {
  const projectRef = getProjectRef()
  if (!projectRef) return false
  const prefix = `sb-${projectRef}-auth-token`
  return request.cookies.getAll().some(({ name }) => name === prefix || name.startsWith(`${prefix}.`))
}

function redirectWithSession(request: NextRequest, sessionResponse: NextResponse, pathname: string): NextResponse {
  const response = NextResponse.redirect(new URL(pathname, request.url))
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie))
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = sessionResponse.headers.get(header)
    if (value) response.headers.set(header, value)
  }
  return response
}

function loginRedirect(request: NextRequest, sessionResponse = NextResponse.next()): NextResponse {
  const loginUrl = new URL('/login', request.url)
  const destination = `${request.nextUrl.pathname}${request.nextUrl.search}`
  loginUrl.searchParams.set('redirect', getSafeAuthRedirect(destination))
  return redirectWithSession(request, sessionResponse, loginUrl.pathname + loginUrl.search)
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname
  const publicPath = isPublicPath(pathname)
  const authCookiePresent = hasAuthCookie(request)

  if (!authCookiePresent) {
    return publicPath ? NextResponse.next() : loginRedirect(request)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return publicPath ? NextResponse.next() : loginRedirect(request)

  let sessionResponse = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        sessionResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => sessionResponse.cookies.set(name, value, options))
        Object.entries(headers).forEach(([name, value]) => sessionResponse.headers.set(name, value))
      },
    },
  })

  const { data, error } = await supabase.auth.getClaims()
  const isAuthenticated = !error && typeof data?.claims?.sub === 'string'

  if (!isAuthenticated && !publicPath) return loginRedirect(request, sessionResponse)

  if (isAuthenticated && !isAllowedUserEmail(data.claims.email)) {
    await supabase.auth.signOut()
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'not_allowed')
    return redirectWithSession(request, sessionResponse, loginUrl.pathname + loginUrl.search)
  }

  if (isAuthenticated && pathname === '/login') {
    const destination = getSafeAuthRedirect(request.nextUrl.searchParams.get('redirect'))
    return redirectWithSession(request, sessionResponse, destination)
  }

  return sessionResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
