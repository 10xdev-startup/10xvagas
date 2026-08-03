'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bookmark, BriefcaseBusiness, CircleDot, LoaderCircle, RotateCcw, SlidersHorizontal, Sparkles, UserRoundCheck } from 'lucide-react'
import { JobRadar } from '@/components/JobRadar'
import { Button } from '@/components/ui/button'
import { jobService } from '@/services/jobService'
import type { JobListResponse } from '@/types/job'

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: JobListResponse }

function formatSnapshotDate(value: string | null): string {
  if (!value) return 'aguardando a primeira coleta'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function DashboardWorkspace() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(() => {
    setState({ status: 'loading' })
    void jobService.list()
      .then((data) => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error' }))
  }, [])

  useEffect(() => {
    void jobService.list()
      .then((data) => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error' }))
  }, [])

  const data = state.status === 'ready' ? state.data : null
  const jobs = data?.jobs ?? []
  const brazilCount = jobs.filter((job) => job.market === 'brazil').length
  const internationalCount = jobs.filter((job) => job.market === 'international').length
  const strongMatchesCount = jobs.filter((job) => (job.score ?? 0) >= 80).length

  return (
    <main className="mx-auto w-full max-w-[1680px] pb-12">
      <header className="grid gap-8 border-b border-border/70 pb-7 pt-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span className="text-brand">Radar 01</span>
            <span className="h-px w-8 bg-border" />
            Atualizado {formatSnapshotDate(data?.collectedAt ?? null)}
          </div>
          <h1 className="mt-4 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.045em] text-foreground md:text-5xl">Encontre o trabalho certo.<br /><span className="font-normal text-muted-foreground">Ignore o resto.</span></h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">Um radar pessoal para comparar a descrição original, entender o match e decidir onde vale investir uma candidatura bem feita.</p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button asChild variant="outline"><Link href="/saved"><Bookmark />Shortlist</Link></Button>
          <Button asChild variant="outline"><Link href="/profile"><SlidersHorizontal />Ajustar perfil</Link></Button>
        </div>
      </header>

      <section aria-label="Resumo do radar" className="grid border-b border-border/70 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'No radar', value: jobs.length, detail: `${brazilCount} Brasil · ${internationalCount} exterior`, icon: BriefcaseBusiness },
          { label: 'Matches fortes', value: strongMatchesCount, detail: 'score inicial acima de 80', icon: Sparkles },
          { label: 'Perfil', value: 'Canônico', detail: 'preferências isoladas por usuário', icon: UserRoundCheck },
          { label: 'Controle', value: 'Review', detail: 'você confirma o envio', icon: CircleDot },
        ].map(({ label, value, detail, icon: Icon }, index) => (
          <div className="flex items-start justify-between border-border/70 px-1 py-5 sm:px-5 sm:[&:nth-child(even)]:border-l lg:border-l lg:first:border-l-0" key={label}>
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{String(index + 1).padStart(2, '0')} · {label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p><p className="mt-1 text-[11px] text-muted-foreground">{detail}</p></div>
            <Icon className="mt-1 size-4 text-brand" />
          </div>
        ))}
      </section>

      <div className="mt-8">
        {state.status === 'loading' && <div className="flex min-h-[420px] items-center justify-center border border-border bg-card"><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-brand" /><p className="mt-3 text-sm font-medium">Sincronizando seu radar</p><p className="mt-1 text-xs text-muted-foreground">Buscando vagas e matches no backend.</p></div></div>}
        {state.status === 'error' && <div className="flex min-h-[420px] items-center justify-center border border-border bg-card"><div className="max-w-sm text-center"><p className="text-sm font-semibold">Não foi possível carregar o radar.</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Confira se o backend está disponível e tente novamente.</p><Button className="mt-5" onClick={load} variant="outline"><RotateCcw />Tentar novamente</Button></div></div>}
        {data && <JobRadar brazilCount={brazilCount} internationalCount={internationalCount} jobs={jobs} sources={data.sources} />}
      </div>
    </main>
  )
}

