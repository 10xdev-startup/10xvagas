'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Check } from 'lucide-react'
import { CircleDashed } from 'lucide-react'
import { FileSearch } from 'lucide-react'
import { LoaderCircle } from 'lucide-react'
import { Sparkles } from 'lucide-react'
import { Square } from 'lucide-react'
import { Wrench } from 'lucide-react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProfileAnalysisEvent } from '@/types/profileAnalysis'
import type { ProfileAnalysisJob } from '@/types/profileAnalysis'

const TERMINAL = new Set<ProfileAnalysisJob['status']>(['cancelled', 'failed', 'succeeded'])

function EventIcon({ event }: { event: ProfileAnalysisEvent }) {
  if (event.eventType === 'completed') return <Check className="size-3.5" />
  if (event.eventType === 'tool_call' || event.eventType === 'tool_result') return <Wrench className="size-3.5" />
  if (event.stage === 'document_extraction') return <FileSearch className="size-3.5" />
  return <Sparkles className="size-3.5" />
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value))
}

export function ProfileAnalysisProgressModal({
  events,
  job,
  onCancel,
  onOpenChange,
  open,
}: {
  events: ProfileAnalysisEvent[]
  job: ProfileAnalysisJob
  onCancel: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const isTerminal = TERMINAL.has(job.status)
  const isSuccessful = job.status === 'succeeded'
  const visibleEvents = events.length > 0 ? events : [{
    createdAt: job.createdAt,
    eventKey: 'queued-fallback',
    eventType: 'stage' as const,
    id: -1,
    message: job.currentStep ?? 'Currículo recebido e aguardando processamento',
    metadata: {},
    progress: job.progress,
    stage: 'queued',
  }]
  const latest = visibleEvents.at(-1)
  const circumference = 2 * Math.PI * 42
  const offset = circumference - (Math.min(100, Math.max(0, job.progress)) / 100) * circumference

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-border bg-card shadow-2xl outline-none">
          <div className="relative overflow-hidden border-b border-border px-6 py-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand to-transparent" />
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">Análise em background</p>
                <Dialog.Title className="mt-2 text-xl font-semibold tracking-tight">
                  {isSuccessful ? 'Seu novo perfil está pronto' : job.status === 'failed' ? 'A análise encontrou um problema' : 'Transformando currículo em sinal'}
                </Dialog.Title>
                <Dialog.Description className="mt-2 max-w-lg text-xs leading-5 text-muted-foreground">
                  Você pode fechar esta janela. O processamento continua seguro no servidor e não altera seu perfil sem aprovação.
                </Dialog.Description>
              </div>
              <Dialog.Close aria-label="Fechar acompanhamento" className="grid size-8 shrink-0 place-items-center border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <X className="size-4" />
              </Dialog.Close>
            </div>
          </div>

          <div className="grid overflow-y-auto md:grid-cols-[190px_1fr]">
            <div className="flex flex-col items-center justify-center border-b border-border bg-background/40 p-6 md:border-b-0 md:border-r">
              <div className="relative size-32">
                <svg aria-hidden="true" className="size-32 -rotate-90" viewBox="0 0 100 100">
                  <circle className="fill-none stroke-muted" cx="50" cy="50" r="42" strokeWidth="5" />
                  <circle className="fill-none stroke-brand transition-[stroke-dashoffset] duration-700" cx="50" cy="50" r="42" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="square" strokeWidth="5" />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  {isSuccessful ? <Check className="size-7 text-match-strong" /> : isTerminal ? <CircleDashed className="size-7 text-match-partial" /> : <><span className="font-mono text-2xl font-semibold">{job.progress}%</span><span className="text-[9px] uppercase tracking-wider text-muted-foreground">concluído</span></>}
                </div>
              </div>
              <p className="mt-4 max-w-[150px] text-center text-xs font-medium leading-5">{latest?.message}</p>
              <span className="mt-3 border border-border bg-muted/40 px-2 py-1 font-mono text-[9px] uppercase text-muted-foreground">{job.modelId}</span>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">O que está acontecendo</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Eventos persistidos; você não perde o histórico se o serviço reiniciar.</p>
                </div>
                {!isTerminal ? <LoaderCircle className="size-4 animate-spin text-brand" /> : null}
              </div>

              <ol className="mt-5 max-h-72 space-y-1 overflow-y-auto pr-2">
                {visibleEvents.map((event, index) => {
                  const isLatest = index === visibleEvents.length - 1
                  return (
                    <li className="grid grid-cols-[28px_1fr_auto] items-start gap-3 py-2" key={event.eventKey}>
                      <span className={cn(
                        'grid size-7 place-items-center border',
                        isLatest && !isTerminal ? 'border-brand/40 bg-brand/10 text-brand' : 'border-border bg-muted/40 text-muted-foreground',
                        event.eventType === 'completed' && 'border-match-strong/40 bg-match-strong/10 text-match-strong',
                      )}>
                        <EventIcon event={event} />
                      </span>
                      <div>
                        <p className={cn('text-xs leading-5', isLatest ? 'font-medium text-foreground' : 'text-muted-foreground')}>{event.message}</p>
                        {typeof event.metadata['tool'] === 'string' ? <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">tool · {event.metadata['tool']}</p> : null}
                      </div>
                      <time className="pt-1 font-mono text-[9px] text-muted-foreground">{formatTime(event.createdAt)}</time>
                    </li>
                  )
                })}
              </ol>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                <p className="text-[10px] text-muted-foreground">{job.documentName}</p>
                {!isTerminal ? <Button onClick={onCancel} size="sm" variant="ghost"><Square className="size-3" />Cancelar</Button> : <Button onClick={() => onOpenChange(false)} size="sm">{isSuccessful ? 'Revisar resultado' : 'Fechar'}</Button>}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
