import type { Metadata } from 'next'
import { MarketingLandingPage } from '@/components/MarketingLandingPage'
import { getSafeAuthRedirect } from '@/lib/authRedirect'

export const metadata: Metadata = {
  title: '10xVagas — Encontre direção na sua busca por trabalho',
  description: 'Descubra vagas aderentes ao seu perfil, entenda cada match e prepare candidaturas melhores sem perder o controle do envio.',
}

type HomePageProps = {
  searchParams: Promise<{ redirect?: string | string[] }>
}

export default async function HomePage({ searchParams }: HomePageProps): Promise<React.JSX.Element> {
  const params = await searchParams
  const requestedRedirect = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect
  const destination = getSafeAuthRedirect(requestedRedirect)
  const loginUrl = `/login?redirect=${encodeURIComponent(destination)}`

  return <MarketingLandingPage loginUrl={loginUrl} />
}
