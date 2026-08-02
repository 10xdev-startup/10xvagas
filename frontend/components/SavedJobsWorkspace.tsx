'use client'

import Link from 'next/link'
import { Bookmark, ScanSearch } from 'lucide-react'
import { JobRadar } from '@/components/JobRadar'
import { Button } from '@/components/ui/button'
import { useSavedJobs } from '@/lib/savedJobsStore'

export function SavedJobsWorkspace() {
  const { jobs, syncStatus } = useSavedJobs()
  const brazilCount = jobs.filter((job) => job.market === 'brazil').length
  const internationalCount = jobs.length - brazilCount

  return (
    <main className="mx-auto w-full max-w-[1680px] pb-12">
      <header className="flex flex-col justify-between gap-6 border-b border-border/70 pb-7 pt-2 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Shortlist pessoal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-foreground md:text-5xl">Decida com calma.<br /><span className="font-normal text-muted-foreground">Candidate melhor.</span></h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">As oportunidades que merecem uma segunda leitura ficam aqui, com descrição, match e gaps preservados.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right"><p className="font-mono text-2xl font-semibold">{jobs.length}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">{syncStatus === 'syncing' ? 'sincronizando' : syncStatus === 'error' ? 'salvas localmente' : 'salvas'}</p></div>
          <Button asChild variant="outline"><Link href="/"><ScanSearch />Voltar ao Radar</Link></Button>
        </div>
      </header>

      {jobs.length > 0 ? <div className="mt-8"><JobRadar brazilCount={brazilCount} internationalCount={internationalCount} jobs={jobs} mode="saved" /></div> : (
        <section className="mt-8 flex min-h-[460px] items-center justify-center border border-dashed border-border bg-card/35 p-8 text-center">
          <div className="max-w-sm"><Bookmark className="mx-auto size-7 text-brand" /><h2 className="mt-5 text-xl font-semibold">Sua shortlist começa no Radar</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Use o marcador em qualquer vaga. Ela aparece aqui na hora e fica disponível neste navegador.</p><Button asChild className="mt-6"><Link href="/"><ScanSearch />Explorar vagas</Link></Button></div>
        </section>
      )}
    </main>
  )
}
