import { Activity, CircleCheck, DatabaseZap, ExternalLink, ShieldAlert } from 'lucide-react'
import type { SourceStatus } from '@/types/job'
import { cn } from '@/lib/utils'

const NOTES: Record<string, string> = {
  remotive: 'Feed público para vagas remotas internacionais.',
  remoteok: 'Feed público, normalizado antes do matching.',
  weworkremotely: 'Fonte internacional de trabalho remoto.',
  linkedin: 'Leitura assistida. Login e candidatura nunca são automatizados.',
  indeed: 'Busca assistida; o link original fica preservado.',
}

function formatRunAt(value: string | null): string {
  if (!value) return 'sem execução registrada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

export function SourcesLedger({ sources }: { sources: SourceStatus[] }) {
  const automatic = sources.filter((source) => source.mode === 'automatic')
  const assisted = sources.filter((source) => source.mode === 'assisted')
  const total = sources.reduce((sum, source) => sum + source.count, 0)

  return (
    <main className="mx-auto w-full max-w-[1450px] pb-12">
      <header className="grid gap-7 border-b border-border/70 pb-7 pt-2 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Pipeline de descoberta</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] md:text-5xl">Cada vaga tem origem.<br /><span className="font-normal text-muted-foreground">Cada origem tem limites.</span></h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">Acompanhe saúde, cobertura e modo de operação sem esconder as fontes frágeis atrás de uma caixa-preta.</p></div><div className="grid grid-cols-3 border border-border bg-card"><div className="p-4 text-center"><p className="font-mono text-xl font-semibold">{sources.length}</p><p className="text-[9px] uppercase tracking-wider text-muted-foreground">fontes</p></div><div className="border-x border-border p-4 text-center"><p className="font-mono text-xl font-semibold">{automatic.length}</p><p className="text-[9px] uppercase tracking-wider text-muted-foreground">automáticas</p></div><div className="p-4 text-center"><p className="font-mono text-xl font-semibold">{total}</p><p className="text-[9px] uppercase tracking-wider text-muted-foreground">vagas</p></div></div></header>

      <section className="mt-8 border border-border bg-card"><header className="flex items-center justify-between border-b border-border p-5"><div className="flex items-center gap-3"><DatabaseZap className="size-4 text-brand" /><div><h2 className="text-sm font-semibold">Coleta automática</h2><p className="text-xs text-muted-foreground">Feeds e APIs públicas com a última execução persistida.</p></div></div><span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"><Activity className="size-3 text-match-strong" />saúde observável</span></header><div className="divide-y divide-border/60">{automatic.map((source) => <SourceRow key={source.id} source={source} />)}</div></section>
      <section className="mt-6 border border-border bg-card"><header className="flex items-center justify-between border-b border-border p-5"><div className="flex items-center gap-3"><ShieldAlert className="size-4 text-match-partial" /><div><h2 className="text-sm font-semibold">Fontes assistidas</h2><p className="text-xs text-muted-foreground">Descoberta e leitura com ação humana; sem automação de login ou envio.</p></div></div><span className="text-[10px] uppercase tracking-wider text-muted-foreground">ToS protegido</span></header><div className="divide-y divide-border/60">{assisted.map((source) => <SourceRow key={source.id} source={source} />)}</div></section>
      <aside className="mt-6 grid gap-px border border-border bg-border md:grid-cols-3">{['Greenhouse, Lever e Ashby entram pelo feed público de cada empresa.', 'Gupy, Sólides e portais BR exigem adaptadores isolados e teste de contrato.', 'LinkedIn permanece somente busca/leitura para proteger sua conta pessoal.'].map((text,index) => <div className="bg-background p-5" key={text}><p className="font-mono text-[9px] text-brand">0{index+1}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</aside>
    </main>
  )
}

function SourceRow({ source }: { source: SourceStatus }) {
  const assisted = source.mode === 'assisted'
  const href = source.id === 'linkedin' ? 'https://www.linkedin.com/jobs/' : source.id === 'indeed' ? 'https://br.indeed.com/' : null
  const healthy = source.status === 'ok'
  return <article className="grid gap-4 p-5 md:grid-cols-[48px_1fr_auto] md:items-center"><div className={cn('flex size-10 items-center justify-center border font-mono text-[10px] font-semibold uppercase', assisted ? 'border-brand/25 bg-brand/[.06] text-brand' : healthy ? 'border-match-strong/25 bg-match-strong/5 text-match-strong-foreground' : 'border-match-weak/25 bg-match-weak/5 text-match-weak-foreground')}>{source.label.slice(0,2)}</div><div><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">{source.label}</h3>{healthy && <CircleCheck className="size-3.5 text-match-strong" />}{source.status === 'error' && <ShieldAlert className="size-3.5 text-match-weak" />}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{source.error ? 'A última coleta falhou; o erro completo ficou registrado para diagnóstico.' : NOTES[source.id] ?? (assisted ? 'Fonte assistida com abertura na plataforma original.' : 'Adaptador público normalizado pelo coletor.')}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground/70">{formatRunAt(source.lastRunAt)}</p></div><div className="flex items-center gap-5 md:text-right"><div><p className="font-mono text-lg font-semibold">{assisted ? '—' : source.count}</p><p className="text-[9px] uppercase tracking-wider text-muted-foreground">{assisted ? 'assistida' : healthy ? 'coletadas' : 'falha'}</p></div>{href && <a aria-label={`Abrir ${source.label}`} className="flex size-10 items-center justify-center border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground" href={href} rel="noreferrer" target="_blank"><ExternalLink className="size-3.5" /></a>}</div></article>
}
