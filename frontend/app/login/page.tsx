'use client'

import { ArrowUpRight, BriefcaseBusiness, Fingerprint, Mail, Radar, ShieldCheck, Sparkles } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TenXVagasLogo } from '@/components/TenXVagasLogo'
import { useAuth } from '@/hooks/useAuth'
import { getSafeAuthRedirect } from '@/lib/authRedirect'

const VALUE_POINTS = [
  { number: '01', title: 'Sinal antes do volume', description: 'Oportunidades ranqueadas pelo que você quer construir.' },
  { number: '02', title: 'Contexto em cada match', description: 'Motivos, gaps e faixa salarial sem caixa-preta.' },
  { number: '03', title: 'Você mantém o controle', description: 'O envio começa manual e evolui no seu ritmo.' },
]

function GoogleMark({ className }: { className?: string }): React.JSX.Element {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" fill="#34A853" />
      <path d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.51 6.16-4.51Z" fill="#EA4335" />
    </svg>
  )
}

function LoginContent(): React.JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { isAuthenticated, isLoading, signInWithEmail, signInWithGoogle } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const destination = getSafeAuthRedirect(searchParams.get('redirect'))

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(destination)
  }, [destination, isAuthenticated, isLoading, router])

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_callback') {
      toast.error('Não foi possível concluir o login. Tente novamente.')
    }
  }, [searchParams])

  async function handleGoogleLogin(): Promise<void> {
    setIsSubmitting(true)
    try {
      await signInWithGoogle(destination)
    } catch {
      toast.error('Não foi possível conectar ao Google. Verifique a configuração do Supabase.')
      setIsSubmitting(false)
    }
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await signInWithEmail(email, password)
      router.replace(destination)
    } catch {
      toast.error('E-mail ou senha inválidos.')
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative grid min-h-screen overflow-hidden bg-background lg:grid-cols-[1.08fr_0.92fr]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,hsl(var(--brand)/0.16),transparent_34%),radial-gradient(circle_at_82%_76%,hsl(var(--signal)/0.10),transparent_28%)]" />

      <section className="relative hidden min-h-screen flex-col justify-between border-r border-border/70 p-10 lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center border border-brand/30 bg-brand/10 text-brand shadow-brand-glow">
            <TenXVagasLogo className="size-8" />
          </div>
          <div>
            <p className="text-base font-semibold tracking-tight">10xVagas</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">job intelligence</p>
          </div>
        </div>

        <div className="max-w-2xl py-12">
          <div className="mb-7 inline-flex items-center gap-2 border border-brand/25 bg-brand/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">
            <Radar className="size-3.5" />
            carreira orientada por sinal
          </div>
          <h1 className="max-w-xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.055em] xl:text-7xl">
            Pare de caçar vagas. <span className="text-brand">Encontre direção.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-muted-foreground xl:text-lg">
            Um cockpit pessoal para descobrir oportunidades, entender seu valor de mercado e preparar candidaturas que parecem suas.
          </p>
        </div>

        <div className="grid grid-cols-3 border-y border-border/70">
          {VALUE_POINTS.map((item) => (
            <article key={item.number} className="border-r border-border/70 px-5 py-6 last:border-r-0 first:pl-0">
              <span className="font-mono text-[10px] text-signal">{item.number}</span>
              <h2 className="mt-3 text-sm font-semibold">{item.title}</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-12 flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center border border-brand/30 bg-brand/10 text-brand">
              <TenXVagasLogo className="size-7" />
            </div>
            <span className="font-semibold">10xVagas</span>
          </div>

          <div className="mb-9">
            <div className="mb-5 flex size-11 items-center justify-center border border-border bg-card text-signal">
              <Fingerprint className="size-5" />
            </div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">acesso ao cockpit</p>
            <h2 className="text-3xl font-semibold tracking-[-0.035em]">
              Entre para continuar.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Sua sessão conecta perfil, ranking e histórico de candidaturas.
            </p>
          </div>

          <div className="border border-border/80 bg-card/70 p-2 shadow-surface backdrop-blur-xl">
            <Button className="h-14 w-full justify-between rounded-md text-sm font-semibold" disabled={isLoading || isSubmitting} onClick={handleGoogleLogin}>
              <span className="flex items-center gap-3">
                <GoogleMark className="size-5" />
                {isSubmitting ? 'Conectando...' : 'Continuar com Google'}
              </span>
              <ArrowUpRight className="size-4" />
            </Button>

            <div className="my-3 flex items-center gap-3 px-1">
              <span className="h-px flex-1 bg-border/70" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                ou entre com e-mail
              </span>
              <span className="h-px flex-1 bg-border/70" />
            </div>

            <form className="space-y-3 p-1" onSubmit={handleEmailSubmit}>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="email">E-mail</label>
                <Input autoComplete="email" id="email" onChange={(event) => setEmail(event.target.value)} placeholder="voce@exemplo.com" required type="email" value={email} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="password">Senha</label>
                <Input
                  autoComplete="current-password"
                  id="password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                  type="password"
                  value={password}
                />
              </div>
              <Button className="h-11 w-full text-sm font-semibold" disabled={isLoading || isSubmitting} type="submit" variant="secondary">
                <Mail className="size-4" />
                {isSubmitting ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 border border-border/60 px-3 py-3"><ShieldCheck className="size-4 text-signal" /> Sessão protegida</div>
            <div className="flex items-center gap-2 border border-border/60 px-3 py-3"><BriefcaseBusiness className="size-4 text-brand" /> Um perfil, seus dados</div>
          </div>

          <p className="mt-8 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" />
            O 10xVagas prepara a candidatura; o envio permanece sob seu controle.
          </p>
        </div>
      </section>
    </main>
  )
}

export default function LoginPage(): React.JSX.Element {
  return <Suspense fallback={<main className="min-h-screen bg-background" />}><LoginContent /></Suspense>
}
