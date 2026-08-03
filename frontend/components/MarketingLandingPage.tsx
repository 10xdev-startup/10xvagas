import Link from 'next/link'
import { ArrowRight, BarChart3, Bookmark, Check, ChevronRight, CircleDot, Fingerprint, Globe2, MapPin, Radar, Sparkles, Target, UserRoundCheck } from 'lucide-react'
import { TenXVagasLogo } from '@/components/TenXVagasLogo'
import { ThemeToggle } from '@/components/showcase/blocks/ThemeToggle'
import { Button } from '@/components/ui/button'

const DEFAULT_LOGIN_URL = '/login?redirect=/dashboard'

const PROCESS_STEPS = [
  { number: '01', title: 'Você define a direção', description: 'Perfil, stack desejada, senioridade, modelo de trabalho e faixa salarial.' },
  { number: '02', title: 'O radar elimina o ruído', description: 'Brasil remoto, híbrido em BH e vagas internacionais entram na mesma leitura.' },
  { number: '03', title: 'Cada match vem explicado', description: 'Você vê aderência, motivos, gaps e contexto antes de investir seu tempo.' },
  { number: '04', title: 'A candidatura ganha qualidade', description: 'Currículo e respostas são preparados para a vaga; você mantém o controle.' },
]

const MARKET_SIGNALS = [
  { label: 'Brasil remoto', value: '15 oportunidades', icon: Radar },
  { label: 'BH e região', value: 'híbrido incluído', icon: MapPin },
  { label: 'Exterior', value: 'remoto em USD/EUR', icon: Globe2 },
]

const AUTOPILOT_LEVELS = [
  { level: 'Manual', detail: 'só mostra a vaga' },
  { level: 'Draft', detail: 'prepara e guarda' },
  { level: 'Review', detail: 'você revisa e envia', active: true },
  { level: 'Auto', detail: 'para fontes confiáveis' },
]

function ProductPreview(): React.JSX.Element {
  const jobs = [
    { rank: '01', company: 'Reacher', title: 'Software Engineer — Latam', detail: 'LATAM remoto · US$ 60k–85k', score: '97%', skill: 'Go · TypeScript · APIs' },
    { rank: '02', company: 'Empresa confidencial', title: 'Full Stack Pleno', detail: 'Belo Horizonte · híbrido', score: '89%', skill: 'Node.js · React · PostgreSQL' },
    { rank: '03', company: 'Rollstack', title: 'Software Engineer — TypeScript', detail: 'Américas · remoto', score: '88%', skill: 'TypeScript · React · Tailwind' },
  ]

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      <div className="absolute -inset-x-12 inset-y-8 -z-10 bg-brand/10 blur-3xl" aria-hidden="true" />
      <div className="overflow-hidden border border-border/80 bg-background shadow-surface">
        <div className="flex h-12 items-center justify-between border-b border-border/70 bg-card/70 px-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <TenXVagasLogo className="size-5 text-brand" />
            Radar pessoal
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-match-strong" />
            snapshot atualizado
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="p-4 sm:p-6">
            <div className="mb-5 flex items-end justify-between border-b border-border/70 pb-4">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-brand">Ranking atual</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">Onde vale investir seu tempo</h2>
              </div>
              <span className="hidden text-[10px] text-muted-foreground sm:block">30 vagas analisadas</span>
            </div>

            <div className="divide-y divide-border/70 border-y border-border/70">
              {jobs.map((job) => (
                <article className="grid gap-4 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:items-start" key={job.rank}>
                  <span className="font-mono text-xs text-brand">{job.rank}</span>
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-signal">{job.company}</p>
                    <h3 className="mt-1 truncate text-sm font-semibold">{job.title}</h3>
                    <p className="mt-2 text-[11px] text-muted-foreground">{job.detail}</p>
                    <p className="mt-3 text-[10px] text-muted-foreground">{job.skill}</p>
                  </div>
                  <div className="w-fit border border-match-strong/30 bg-match-strong/10 px-2.5 py-1 text-[10px] font-semibold text-match-strong">
                    {job.score} match
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="border-t border-border/70 bg-card/50 p-5 lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-signal">Chave-mestra</p>
                <h3 className="mt-1 text-sm font-semibold">Perfil Canônico</h3>
              </div>
              <span className="font-mono text-sm font-semibold text-brand">83%</span>
            </div>
            <div className="mt-4 h-1 overflow-hidden bg-muted">
              <div className="h-full w-[83%] bg-brand" />
            </div>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {['TypeScript', 'Node.js', 'React', 'Supabase', 'Go', 'Python'].map((skill) => (
                <span className="border border-brand/20 bg-brand/[0.06] px-2 py-1 text-[9px] text-brand" key={skill}>{skill}</span>
              ))}
            </div>
            <div className="mt-6 border-t border-border/70 pt-5">
              <p className="text-[10px] font-semibold">Por que o primeiro lugar?</p>
              <ul className="mt-3 space-y-3 text-[10px] leading-4 text-muted-foreground">
                <li className="flex gap-2"><Check className="mt-0.5 size-3 shrink-0 text-match-strong" />Stack desejada presente</li>
                <li className="flex gap-2"><Check className="mt-0.5 size-3 shrink-0 text-match-strong" />Faixa salarial aderente</li>
                <li className="flex gap-2"><Check className="mt-0.5 size-3 shrink-0 text-match-strong" />Remoto compatível com LATAM</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

export function MarketingLandingPage({ loginUrl = DEFAULT_LOGIN_URL }: { loginUrl?: string }): React.JSX.Element {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link className="flex items-center gap-2.5" href="/" aria-label="10xVagas — início">
            <TenXVagasLogo className="size-7 text-brand" />
            <span className="text-sm font-semibold tracking-tight">10xVagas</span>
          </Link>

          <nav className="hidden items-center gap-7 text-[11px] font-medium text-muted-foreground md:flex" aria-label="Navegação principal">
            <a className="transition-colors hover:text-foreground" href="#como-funciona">Como funciona</a>
            <a className="transition-colors hover:text-foreground" href="#inteligencia">Inteligência</a>
            <a className="transition-colors hover:text-foreground" href="#controle">Controle</a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle className="rounded-md" />
            <Button asChild className="hidden h-9 rounded-md px-4 text-xs sm:inline-flex" variant="ghost">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild className="h-9 rounded-md px-4 text-xs">
              <Link href={loginUrl}>Abrir radar <ArrowRight className="size-3.5" /></Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-border/70 px-4 pb-16 pt-20 sm:px-6 md:pb-24 md:pt-28 lg:px-8">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--brand)/0.14),transparent_34%),linear-gradient(to_right,hsl(var(--border)/0.24)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.24)_1px,transparent_1px)] bg-[size:auto,40px_40px,40px_40px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" aria-hidden="true" />
          <div className="mx-auto max-w-7xl text-center">
            <div className="inline-flex items-center gap-2 border border-brand/25 bg-brand/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-brand">
              <Sparkles className="size-3.5" />
              Copiloto de candidatura, não bot de spam
            </div>
            <h1 className="mx-auto mt-7 max-w-5xl text-balance text-4xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Sua busca por trabalho precisa de <span className="text-brand">direção.</span>
            </h1>
            <p className="mx-auto mt-7 max-w-2xl text-balance text-base leading-7 text-muted-foreground sm:text-lg">
              Descubra vagas que combinam com o trabalho que você quer fazer, entenda cada match e prepare candidaturas melhores sem perder o controle do envio.
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild className="h-12 rounded-md px-7 text-sm shadow-brand-glow">
                <Link href={loginUrl}>Começar meu radar <ArrowRight className="size-4" /></Link>
              </Button>
              <Button asChild className="h-12 rounded-md px-7 text-sm" variant="outline">
                <a href="#como-funciona">Ver como funciona <ChevronRight className="size-4" /></a>
              </Button>
            </div>
            <p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Começa em modo review · você confirma o envio</p>

            <div className="mt-14 md:mt-20">
              <ProductPreview />
            </div>
          </div>
        </section>

        <section className="border-b border-border/70">
          <div className="mx-auto grid max-w-7xl sm:grid-cols-3">
            {MARKET_SIGNALS.map(({ label, value, icon: Icon }, index) => (
              <div className="flex items-center gap-4 border-b border-border/70 px-5 py-6 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-8" key={label}>
                <span className="font-mono text-[10px] text-brand">0{index + 1}</span>
                <Icon className="size-4 text-signal" />
                <div>
                  <p className="text-xs font-semibold">{label}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="scroll-mt-20 px-4 py-20 sm:px-6 md:py-28 lg:px-8" id="como-funciona">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 border-b border-border/70 pb-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-brand">01 · Como funciona</p>
                <h2 className="mt-4 text-balance text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">Menos caça. Mais decisão.</h2>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground lg:justify-self-end">O 10xVagas organiza a busca como um processo: primeiro entende sua direção, depois reduz o mercado ao que merece análise humana.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4">
              {PROCESS_STEPS.map((step) => (
                <article className="border-b border-border/70 py-8 md:px-6 md:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:first:pl-0 lg:last:border-r-0" key={step.number}>
                  <span className="font-mono text-xs text-signal">{step.number}</span>
                  <h3 className="mt-8 text-base font-semibold">{step.title}</h3>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-20 border-y border-border/70 bg-card/35 px-4 py-20 sm:px-6 md:py-28 lg:px-8" id="inteligencia">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-signal">02 · Inteligência de carreira</p>
              <h2 className="mt-5 max-w-xl text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">O robô aplica. O analista mostra onde você está.</h2>
              <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground">Cada vaga deixa um rastro útil: tecnologias pedidas, gaps recorrentes, salários alcançáveis e fontes que realmente convertem. Sua busca vira leitura de mercado.</p>
              <div className="mt-8 grid gap-px border border-border/70 bg-border/70 sm:grid-cols-2">
                {[
                  { icon: Target, title: 'Match explicável', text: 'Score com motivos e gaps, sem caixa-preta.' },
                  { icon: BarChart3, title: 'Mercado real', text: 'Faixas e tendências baseadas nas vagas aderentes.' },
                  { icon: UserRoundCheck, title: 'Perfil Canônico', text: 'Separa o que você sabe do que quer usar.' },
                  { icon: Bookmark, title: 'Shortlist viva', text: 'Salve, compare e retome decisões importantes.' },
                ].map(({ icon: Icon, title, text }) => (
                  <article className="bg-background p-5" key={title}>
                    <Icon className="size-4 text-brand" />
                    <h3 className="mt-5 text-sm font-semibold">{title}</h3>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="border border-border/80 bg-background p-5 shadow-surface sm:p-7">
              <div className="flex items-start justify-between border-b border-border/70 pb-5">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.17em] text-brand">Leitura consolidada</p>
                  <h3 className="mt-1 text-lg font-semibold">Cobertura do seu mercado</h3>
                </div>
                <BarChart3 className="size-5 text-signal" />
              </div>
              <div className="mt-7 space-y-7">
                {[
                  { label: 'TypeScript / Node.js', value: '24 vagas', width: 'w-[88%]' },
                  { label: 'React / Next.js', value: '19 vagas', width: 'w-[72%]' },
                  { label: 'Python / FastAPI', value: '11 vagas', width: 'w-[48%]' },
                  { label: 'Go / plataformas', value: '7 vagas', width: 'w-[31%]' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-[11px]"><span className="font-medium">{item.label}</span><span className="text-muted-foreground">{item.value}</span></div>
                    <div className="h-1 bg-muted"><div className={`h-full bg-brand ${item.width}`} /></div>
                  </div>
                ))}
              </div>
              <div className="mt-8 border-t border-border/70 pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Gap mais recorrente</p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <div><p className="text-sm font-semibold">Cloud architecture</p><p className="mt-1 text-[10px] text-muted-foreground">aparece em 8 dos seus melhores matches</p></div>
                  <span className="border border-match-partial/30 bg-match-partial/10 px-2.5 py-1 text-[10px] font-semibold text-match-partial">Roadmap</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="scroll-mt-20 px-4 py-20 sm:px-6 md:py-28 lg:px-8" id="controle">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="text-[10px] font-semibold uppercase tracking-[0.19em] text-brand">03 · Controle</p>
                <h2 className="mt-5 text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Automação no seu ritmo.</h2>
                <p className="mt-6 text-sm leading-7 text-muted-foreground">O pipeline é o mesmo. O que muda é onde ele para para pedir sua decisão. Cada fonte pode evoluir conforme você ganha confiança.</p>
              </div>

              <div className="border-y border-border/70">
                {AUTOPILOT_LEVELS.map((item, index) => (
                  <div className={`grid gap-4 border-b border-border/70 px-1 py-6 last:border-b-0 sm:grid-cols-[3rem_8rem_minmax(0,1fr)_auto] sm:items-center ${item.active ? 'bg-brand/[0.05] sm:px-5' : 'sm:px-5'}`} key={item.level}>
                    <span className="font-mono text-[10px] text-muted-foreground">0{index + 1}</span>
                    <span className={`text-sm font-semibold ${item.active ? 'text-brand' : ''}`}>{item.level}</span>
                    <span className="text-xs text-muted-foreground">{item.detail}</span>
                    {item.active ? <span className="flex w-fit items-center gap-1.5 border border-brand/25 bg-brand/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-brand"><CircleDot className="size-3" /> começa aqui</span> : <span className="hidden font-mono text-[9px] text-muted-foreground sm:block">configurável</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/70 px-4 py-20 sm:px-6 md:py-28 lg:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden border border-brand/25 bg-card px-6 py-14 text-center shadow-brand-glow sm:px-12 md:py-20">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--brand)/0.18),transparent_46%)]" aria-hidden="true" />
            <div className="relative">
              <div className="mx-auto flex size-12 items-center justify-center border border-brand/30 bg-brand/10 text-brand"><Fingerprint className="size-5" /></div>
              <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.19em] text-signal">Sua próxima candidatura começa melhor informada</p>
              <h2 className="mx-auto mt-5 max-w-3xl text-balance text-3xl font-semibold tracking-[-0.045em] sm:text-5xl">Pare de aplicar no escuro.</h2>
              <p className="mx-auto mt-5 max-w-xl text-sm leading-6 text-muted-foreground">Monte seu perfil, ligue o radar e escolha as oportunidades que realmente merecem uma candidatura bem feita.</p>
              <Button asChild className="mt-9 h-12 rounded-md px-7 text-sm">
                <Link href={loginUrl}>Criar meu radar <ArrowRight className="size-4" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="flex items-center gap-2.5" href="/"><TenXVagasLogo className="size-6 text-brand" /><span className="text-sm font-semibold">10xVagas</span></Link>
            <p className="mt-3 max-w-sm text-xs leading-5 text-muted-foreground">Inteligência para encontrar, entender e preparar as oportunidades certas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[11px] text-muted-foreground">
            <a className="hover:text-foreground" href="#como-funciona">Como funciona</a>
            <a className="hover:text-foreground" href="#inteligencia">Inteligência</a>
            <Link className="hover:text-foreground" href="/login">Entrar</Link>
            <span>© 2026 10xVagas</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
