import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Building2, MapPin } from 'lucide-react'
import { Suspense } from 'react'
import { CanonicalUrl } from '@/components/CanonicalUrl'
import { resolveJobByPublicId } from '@/lib/resolveJob'
import { jobPath } from '@/lib/resourceUrl'

export default async function JobPage({ params }: { params: Promise<{ publicId: string }> }): Promise<React.JSX.Element> {
  const { publicId } = await params
  // Sombreia o parametro: daqui pra baixo so existe a vaga resolvida.
  const job = await resolveJobByPublicId(publicId)
  if (!job) notFound()

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-5 py-8">
      <Suspense fallback={null}>
        <CanonicalUrl canonicalPath={jobPath(job)} />
      </Suspense>

      <Link className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground" href="/">
        <ArrowLeft className="size-3.5" /> Voltar ao radar
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <span className="border border-border/70 px-2 py-1">{job.sourceLabel}</span>
          <span className="border border-border/70 px-2 py-1">{job.market === 'brazil' ? 'Brasil' : 'Internacional'}</span>
          {job.score !== null && <span className="border border-brand/30 bg-brand/[0.07] px-2 py-1 text-brand">match {job.score}</span>}
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em]">{job.title}</h1>
        <p className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Building2 className="size-4" /> {job.company}</span>
          <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> {job.location}</span>
        </p>
      </header>

      {(job.reasons.length > 0 || job.gaps.length > 0) && (
        <section className="grid gap-6 border-y border-border/70 py-6 sm:grid-cols-2">
          {job.reasons.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Por que dá match</h2>
              <ul className="space-y-1.5 text-sm">{job.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            </div>
          )}
          {job.gaps.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">O que falta</h2>
              <ul className="space-y-1.5 text-sm text-muted-foreground">{job.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {job.description && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Descrição</h2>
          <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{job.description}</p>
        </section>
      )}

      <a
        className="inline-flex items-center gap-2 border border-brand/30 bg-brand/10 px-5 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/20"
        href={job.applyUrl ?? job.sourceUrl}
        rel="noreferrer noopener"
        target="_blank"
      >
        Ver vaga na fonte <ArrowUpRight className="size-4" />
      </a>
    </article>
  )
}
