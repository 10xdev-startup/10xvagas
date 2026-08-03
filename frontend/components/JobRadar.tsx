'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Bookmark, BookmarkCheck, BriefcaseBusiness, Building2, CheckCircle2, ChevronLeft, CircleDollarSign, Clock3, ExternalLink, FileSearch, Globe2, Link2, MapPin, Radar, Search, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { RadarJob, SourceStatus } from '@/types/job'
import { cn } from '@/lib/utils'
import { useSavedJobs } from '@/lib/savedJobsStore'
import { jobPath } from '@/lib/resourceUrl'
import { useSearchPreferences } from '@/lib/searchPreferencesStore'

type MarketFilter = 'all' | 'brazil' | 'international'
type StatusFilter = 'all' | 'matched' | 'new'

type JobRadarProps = {
  jobs: RadarJob[]
  sources?: SourceStatus[]
  brazilCount: number
  internationalCount: number
  mode?: 'radar' | 'saved'
}

function formatEmploymentType(value: string | null): string {
  if (!value) return 'Regime não informado'
  const labels: Record<string, string> = {
    clt: 'CLT',
    contractor: 'Contractor',
    contract: 'Contrato',
    full_time: 'Tempo integral',
    FullTime: 'Tempo integral',
    internship: 'Estágio',
    permanent: 'Permanente',
    pj: 'PJ',
  }
  return labels[value] ?? value.replaceAll('_', ' ')
}

function formatWorkplace(value: string): string {
  const normalized = value.toLocaleLowerCase('pt-BR')
  if (normalized.includes('hybrid')) return 'Híbrida'
  if (normalized.includes('remote')) return 'Remota'
  if (normalized.includes('onsite') || normalized.includes('on-site')) return 'Presencial'
  return 'Modelo não informado'
}

function formatPublishedAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date)
}

function scoreLabel(score: number): string {
  if (score >= 80) return 'forte'
  if (score >= 60) return 'parcial'
  return 'fraco'
}

function sourceStatusTone(status: SourceStatus['status']): string {
  if (status === 'ok') return 'bg-match-strong'
  if (status === 'assisted') return 'bg-brand'
  return 'bg-match-weak'
}

function SourceIndicator({ source }: { source: SourceStatus }) {
  const content = (
    <>
      <span className={cn('size-1.5 rounded-full', sourceStatusTone(source.status))} />
      <span>{source.label}</span>
      <span className="font-mono text-[10px] text-muted-foreground/70">{source.mode === 'assisted' ? 'assistida' : source.count}</span>
    </>
  )
  const className = 'inline-flex items-center gap-2 text-xs text-muted-foreground transition hover:text-foreground'
  if (source.mode === 'assisted') {
    const href = source.id === 'linkedin' ? 'https://www.linkedin.com/jobs/' : 'https://br.indeed.com/'
    return <a className={className} href={href} rel="noreferrer" target="_blank">{content}</a>
  }
  return <span className={className}>{content}</span>
}

function JobListItem({ active, job, onSelect, onToggleSaved, saved }: { active: boolean; job: RadarJob; onSelect: () => void; onToggleSaved: () => void; saved: boolean }) {
  const publishedAt = formatPublishedAt(job.publishedAt)
  return (
    <div
      className={cn(
        'group relative flex w-full border-b border-border/60 text-left transition last:border-b-0',
        active ? 'bg-foreground text-background' : 'bg-card/20 text-foreground hover:bg-accent/45'
      )}
    >
      <button aria-selected={active} className="min-w-0 flex-1 px-4 py-4 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={onSelect} role="option" type="button">
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex size-9 shrink-0 items-center justify-center border font-mono text-[10px] font-semibold uppercase tracking-wide',
          active ? 'border-background/20 bg-background/10 text-background' : 'border-border bg-muted/40 text-muted-foreground'
        )}>
          {job.sourceLabel.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('truncate text-[11px] font-semibold uppercase tracking-[0.13em]', active ? 'text-background/65' : 'text-muted-foreground')}>{job.company}</p>
            {job.score !== null ? (
              <span className={cn('font-mono text-xs font-semibold tabular-nums', active ? 'text-background' : job.score >= 80 ? 'text-match-strong-foreground' : 'text-match-partial-foreground')}>{Math.round(job.score)}</span>
            ) : (
              <span className={cn('text-[9px] font-semibold uppercase tracking-wider', active ? 'text-background/70' : 'text-brand')}>nova</span>
            )}
          </div>
          <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5">{job.title}</h3>
          <div className={cn('mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]', active ? 'text-background/60' : 'text-muted-foreground')}>
            <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{job.location}</span>
            {publishedAt && <span className="inline-flex items-center gap-1"><Clock3 className="size-3" />{publishedAt}</span>}
          </div>
        </div>
      </div>
      </button>
      <button aria-label={saved ? `Remover ${job.title} das vagas salvas` : `Salvar ${job.title}`} aria-pressed={saved} className={cn('absolute right-3 top-3 flex size-9 items-center justify-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active ? 'text-background/70 hover:bg-background/10 hover:text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground')} onClick={onToggleSaved} type="button">
        {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      </button>
    </div>
  )
}

function JobDossier({ job, onBack, onToggleSaved, saved }: { job: RadarJob; onBack: () => void; onToggleSaved: () => void; saved: boolean }) {
  const score = job.score
  return (
    <article className="flex min-h-0 flex-col bg-card">
      <header className="border-b border-border/60 px-6 py-6 lg:px-8">
        <button className="mb-5 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden" onClick={onBack} type="button"><ChevronLeft className="size-4" />Voltar às vagas</button>
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-start">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold uppercase tracking-[0.14em] text-brand">{job.sourceLabel}</span>
              <span aria-hidden="true">/</span>
              <span>{job.company}</span>
              {job.status === 'new' && <span className="border border-brand/25 bg-brand/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand">nova descoberta</span>}
            </div>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-[-0.025em] text-foreground lg:text-3xl">{job.title}</h2>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{job.location}</span>
              <span className="inline-flex items-center gap-1.5"><Globe2 className="size-3.5" />{formatWorkplace(job.workplaceType)}</span>
              <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" />{formatEmploymentType(job.employmentType)}</span>
              {job.salary && <span className="inline-flex items-center gap-1.5"><CircleDollarSign className="size-3.5" />{job.salary}</span>}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {score !== null && (
              <div className="border-r border-border pr-4 text-right">
                <p className="font-mono text-3xl font-semibold leading-none text-foreground">{Math.round(score)}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">match {scoreLabel(score)}</p>
              </div>
            )}
            <button aria-label={saved ? 'Remover das vagas salvas' : 'Salvar vaga'} aria-pressed={saved} className="inline-flex size-10 items-center justify-center border border-border bg-card text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onToggleSaved} type="button">
              {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
            </button>
            <Link className="inline-flex h-10 items-center gap-2 border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-muted" href={jobPath(job)}>
              Abrir página <Link2 className="size-3.5" />
            </Link>
            <a className="inline-flex h-10 items-center gap-2 bg-foreground px-4 text-xs font-semibold text-background transition hover:opacity-85" href={job.applyUrl ?? job.sourceUrl} rel="noreferrer" target="_blank">
              Ver vaga <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid divide-y divide-border/60 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.65fr)] xl:divide-x xl:divide-y-0">
          <section className="px-6 py-7 lg:px-8">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Descrição original</p>
                <h3 className="mt-1 text-base font-semibold text-foreground">O que a empresa está procurando</h3>
              </div>
              <a className="text-xs text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground" href={job.sourceUrl} rel="noreferrer" target="_blank">ver na fonte</a>
            </div>
            <div className="whitespace-pre-line text-sm leading-7 text-secondary-foreground">{job.description}</div>
          </section>

          <aside className="space-y-7 px-6 py-7">
            {score !== null ? (
              <>
                <section>
                  <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-match-strong" /><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Por que combina</h3></div>
                  <ul className="mt-4 space-y-3">
                    {job.reasons.slice(0, 3).map((reason) => <li className="text-xs leading-5 text-muted-foreground" key={reason}>{reason}</li>)}
                  </ul>
                </section>
                <section className="border-t border-border/60 pt-6">
                  <div className="flex items-center gap-2"><TriangleAlert className="size-4 text-match-partial" /><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Pontos de atenção</h3></div>
                  {job.gaps.length > 0 ? (
                    <ul className="mt-4 space-y-3">{job.gaps.map((gap) => <li className="text-xs leading-5 text-muted-foreground" key={gap}>{gap}</li>)}</ul>
                  ) : <p className="mt-4 text-xs leading-5 text-muted-foreground">Nenhum gap relevante detectado no baseline.</p>}
                </section>
                <section className="border-t border-border/60 pt-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Tecnologias pedidas</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">{job.skills.slice(0, 10).map((skill) => <span className="border border-border bg-muted/35 px-2 py-1 text-[10px] text-secondary-foreground" key={skill}>{skill}</span>)}</div>
                </section>
              </>
            ) : (
              <section className="border-l-2 border-brand pl-4">
                <div className="flex items-center gap-2"><FileSearch className="size-4 text-brand" /><h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Aguardando análise</h3></div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">A vaga acabou de chegar da fonte. Ela entra na próxima rodada do matcher antes de receber score e gaps.</p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </article>
  )
}

export function JobRadar({ jobs, sources = [], brazilCount, internationalCount, mode = 'radar' }: JobRadarProps) {
  const [market, setMarket] = useState<MarketFilter>('all')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(jobs[0]?.id ?? '')
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const savedJobs = useSavedJobs()
  const { preferences } = useSearchPreferences()

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return jobs.filter((job) => {
      if (mode === 'radar') {
        const workplace = job.workplaceType.toLocaleLowerCase('pt-BR')
        const location = job.location.toLocaleLowerCase('pt-BR')
        if (job.market === 'international' && (!preferences.internationalRemote || !workplace.includes('remote'))) return false
        if (job.market === 'brazil' && workplace.includes('remote') && !preferences.brazilRemote) return false
        if (job.market === 'brazil' && workplace.includes('hybrid')) {
          const isBhRegion = ['belo horizonte', 'bh', 'contagem', 'betim', 'nova lima', 'minas gerais', 'mg'].some((term) => location.includes(term))
          if (!preferences.bhHybrid || !isBhRegion) return false
        }
        if (job.market === 'brazil' && !workplace.includes('remote') && !workplace.includes('hybrid')) return false
        if (job.score !== null && job.score < preferences.minScore) return false
      }
      if (market !== 'all' && job.market !== market) return false
      if (status !== 'all' && job.status !== status) return false
      if (!normalizedQuery) return true
      return [job.company, job.title, job.location, job.sourceLabel, ...job.skills]
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(normalizedQuery)
    })
  }, [jobs, market, mode, preferences, query, status])
  const selectedJob = filteredJobs.find((job) => job.id === selectedId) ?? filteredJobs[0] ?? null

  function handleToggleSaved(job: RadarJob): void {
    const nowSaved = savedJobs.toggle(job)
    toast.success(nowSaved ? 'Vaga adicionada à sua shortlist.' : 'Vaga removida das salvas.')
  }

  return (
    <section id="radar" className="overflow-hidden border border-border/70 bg-card shadow-surface">
      {sources.length > 0 && mode === 'radar' && <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><Radar className="size-3.5 text-brand" />Fontes</div>
          {sources.map((source) => <SourceIndicator key={source.id} source={source} />)}
        </div>
      </div>}

      <div className="grid min-h-[690px] lg:max-h-[calc(100svh-13rem)] lg:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.5fr)]">
        <div className={cn('min-h-0 flex-col border-b border-border/60 bg-background/35 lg:flex lg:border-b-0 lg:border-r', mobileDetailOpen ? 'hidden' : 'flex')}>
          <div className="space-y-3 border-b border-border/60 p-4">
            <label className="relative block">
              <span className="sr-only">Buscar vagas</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input className="h-10 w-full border border-border bg-card pl-9 pr-3 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-foreground/35" onChange={(event) => setQuery(event.target.value)} placeholder="Cargo, empresa, tecnologia" type="search" value={query} />
            </label>
            <div className="grid grid-cols-3 border border-border bg-muted/25 p-0.5">
              {([
                ['all', 'Todas', jobs.length],
                ['brazil', 'Brasil', brazilCount],
                ['international', 'Exterior', internationalCount],
              ] as const).map(([value, label, count]) => (
                <button className={cn('px-2 py-2 text-[11px] font-medium transition', market === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground')} key={value} onClick={() => setMarket(value)} type="button">{label} <span className="ml-1 font-mono text-[9px] opacity-65">{count}</span></button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground"><strong className="font-semibold text-foreground">{filteredJobs.length}</strong> oportunidades</p>
              <div className="flex items-center gap-3">
                {([['all', 'todas'], ['matched', 'analisadas'], ['new', 'novas']] as const).map(([value, label]) => <button className={cn('text-[10px] font-medium transition', status === value ? 'text-foreground underline decoration-brand underline-offset-4' : 'text-muted-foreground hover:text-foreground')} key={value} onClick={() => setStatus(value)} type="button">{label}</button>)}
              </div>
            </div>
            {mode === 'radar' && <p className="border-l-2 border-brand pl-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Busca: {[preferences.brazilRemote && 'Brasil remoto', preferences.bhHybrid && 'BH/RMBH híbrido', preferences.internationalRemote && 'exterior remoto'].filter(Boolean).join(' · ') || 'nenhum mercado ativo'}{preferences.minScore > 0 ? ` · score ${preferences.minScore}+` : ''}</p>}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label={mode === 'saved' ? 'Vagas salvas' : 'Oportunidades encontradas'}>
            {filteredJobs.map((job) => <JobListItem active={selectedJob?.id === job.id} job={job} key={job.id} onSelect={() => { setSelectedId(job.id); setMobileDetailOpen(true) }} onToggleSaved={() => handleToggleSaved(job)} saved={savedJobs.isSaved(job)} />)}
            {filteredJobs.length === 0 && <div className="px-6 py-16 text-center"><Search className="mx-auto size-5 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">{mode === 'saved' ? 'Sua shortlist está vazia' : 'Nada por aqui'}</p><p className="mt-1 text-xs text-muted-foreground">{mode === 'saved' ? 'Salve oportunidades no Radar para comparar com calma.' : 'Remova um filtro ou tente outro termo.'}</p></div>}
          </div>
        </div>

        <div className={cn('min-h-0 lg:block', mobileDetailOpen ? 'block' : 'hidden')}>
          {selectedJob ? <JobDossier job={selectedJob} onBack={() => setMobileDetailOpen(false)} onToggleSaved={() => handleToggleSaved(selectedJob)} saved={savedJobs.isSaved(selectedJob)} /> : <div className="flex min-h-[460px] items-center justify-center bg-card p-8 text-center"><div><Building2 className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">Selecione uma oportunidade</p></div></div>}
        </div>
      </div>
    </section>
  )
}
