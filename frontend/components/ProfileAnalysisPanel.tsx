'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, FileSearch, FileUp, Languages, LoaderCircle, RefreshCw, Sparkles, Square, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { ProfileAnalysisProgressModal } from '@/components/ProfileAnalysisProgressModal'
import type { CanonicalProfile } from '@/types/profile'
import { applyAnswersToProfileDraft } from '@/lib/profileDraftAnswers'
import { cn } from '@/lib/utils'
import { billingService, type BillingStatus } from '@/services/billingService'
import { profileAnalysisService } from '@/services/profileAnalysisService'
import type { ProfileAnalysisDetail } from '@/types/profileAnalysis'
import type { ProfileAnalysisJob } from '@/types/profileAnalysis'
import type { ProfileAnalysisModelOption } from '@/types/profileAnalysis'
import type { ProfileAnalysisPreferences } from '@/types/profileAnalysis'
import { DiffViewer, type DiffLine } from '@/components/showcase/blocks/DiffViewer'
import { Button } from '@/components/ui/button'

const TERMINAL = new Set(['cancelled', 'succeeded', 'failed'])
const STATUS_LABEL: Record<ProfileAnalysisJob['status'], string> = {
  queued: 'Na fila',
  running: 'Analisando',
  cancel_requested: 'Cancelando',
  cancelled: 'Cancelada',
  succeeded: 'Pronta para revisão',
  failed: 'Falhou',
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function objectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item))
    : []
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(cents / 100)
}

function buildDiff(current: CanonicalProfile | null, proposed: Record<string, unknown>): DiffLine[] {
  const desired = objectArray(proposed['skills_desired'])
    .map((item) => typeof item['name'] === 'string' ? item['name'] : '')
    .filter(Boolean)
  const currentSkills = current?.skills_desired.map((item) => item.name) ?? []
  const currentRoles = current?.work_preferences.target_roles ?? []
  const workPreferences = proposed['work_preferences']
  const proposedRoles = typeof workPreferences === 'object' && workPreferences !== null
    ? stringArray((workPreferences as Record<string, unknown>)['target_roles'])
    : []
  return [
    { type: 'del', text: `Stack atual: ${currentSkills.join(', ') || 'sem perfil ativo'}` },
    { type: 'add', text: `Stack proposta: ${desired.join(', ') || 'não identificada'}` },
    { type: 'del', text: `Cargos atuais: ${currentRoles.join(', ') || 'não definidos'}` },
    { type: 'add', text: `Cargos propostos: ${proposedRoles.join(', ') || 'não definidos'}` },
  ]
}

export function ProfileAnalysisPanel({ currentProfile = null, compact = false, onProfileApproved }: { currentProfile?: CanonicalProfile | null; compact?: boolean; onProfileApproved?: () => void }) {
  const [billing, setBilling] = useState<BillingStatus | null>(null)
  const [billingError, setBillingError] = useState(false)
  const [detail, setDetail] = useState<ProfileAnalysisDetail | null>(null)
  const [history, setHistory] = useState<ProfileAnalysisJob[]>([])
  const [models, setModels] = useState<ProfileAnalysisModelOption[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [progressOpen, setProgressOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [targetRoles, setTargetRoles] = useState(currentProfile?.work_preferences.target_roles.join(', ') ?? '')
  const [desiredSkills, setDesiredSkills] = useState(currentProfile?.skills_desired.map((item) => item.name).join(', ') ?? '')
  const [focus, setFocus] = useState<ProfileAnalysisPreferences['focus']>('full_stack')
  const [language, setLanguage] = useState<ProfileAnalysisPreferences['language']>('pt')
  const [markets, setMarkets] = useState<ProfileAnalysisPreferences['markets']>('both')
  const [resultLanguage, setResultLanguage] = useState<'pt' | 'en'>('pt')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [pollingError, setPollingError] = useState(false)
  const pollingJobId = detail?.job.id
  const pollingJobStatus = detail?.job.status

  useEffect(() => {
    let active = true
    void Promise.allSettled([profileAnalysisService.list(), billingService.status(), profileAnalysisService.models()])
      .then(async ([historyResult, billingResult, modelsResult]) => {
        if (!active) return
        if (billingResult.status === 'fulfilled') setBilling(billingResult.value)
        else setBillingError(true)
        if (modelsResult.status === 'fulfilled') {
          setModels(modelsResult.value.models)
          setSelectedModelId(modelsResult.value.defaultModelId)
        }
        if (historyResult.status === 'rejected') {
          toast.error('Não foi possível carregar as análises do perfil.')
          return
        }
        const { jobs } = historyResult.value
        setHistory(jobs)
        if (!jobs[0]) return
        try {
          const next = await profileAnalysisService.get(jobs[0].id)
          if (!active) return
          setDetail(next)
          if (!TERMINAL.has(next.job.status)) setProgressOpen(true)
          if (next.analysis) setDraftText(JSON.stringify(next.analysis.canonicalProfileDraft, null, 2))
        } catch {
          if (active) toast.error('Não foi possível carregar a análise mais recente.')
        }
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!pollingJobId || !pollingJobStatus || TERMINAL.has(pollingJobStatus)) return
    let failures = 0
    const timer = window.setInterval(() => {
      profileAnalysisService.get(pollingJobId)
        .then((next) => {
          failures = 0
          setPollingError(false)
          setDetail(next)
          setHistory((items) => items.map((item) => item.id === next.job.id ? next.job : item))
          if (next.analysis) setDraftText(JSON.stringify(next.analysis.canonicalProfileDraft, null, 2))
        })
        .catch(() => {
          failures += 1
          if (failures >= 3) setPollingError(true)
        })
    }, 2_000)
    return () => window.clearInterval(timer)
  }, [pollingJobId, pollingJobStatus])

  const canStart = Boolean(file && selectedModelId && billing && billing.balanceCents >= billing.minimumAnalysisCreditsCents && !submitting && (!detail || TERMINAL.has(detail.job.status)))
  const assessment = detail?.analysis?.cvAssessment ?? {}
  const recommendations = stringArray(assessment['prioritized_recommendations'])
  const strengths = stringArray(assessment['strengths'])
  const pendingQuestions = objectArray(detail?.analysis?.pendingQuestions)
  const evidence = objectArray(detail?.analysis?.sourceEvidence)
  const diff = detail?.analysis ? buildDiff(currentProfile, detail.analysis.canonicalProfileDraft) : []

  async function submit(): Promise<void> {
    if (!file) return
    const preferences: ProfileAnalysisPreferences = {
      desiredSkills: desiredSkills.split(',').map((name) => name.trim()).filter(Boolean).map((name) => ({ name, priority: 3 })),
      focus,
      language,
      markets,
      targetRoles: targetRoles.split(',').map((role) => role.trim()).filter(Boolean),
    }
    try {
      setSubmitting(true)
      const { job } = await profileAnalysisService.create(file, preferences, selectedModelId)
      const next = { job, analysis: null, events: [] }
      setDetail(next)
      setHistory((items) => [job, ...items])
      setProgressOpen(true)
      toast.success('Currículo enviado. A análise começou em background.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível iniciar a análise.')
    } finally {
      setSubmitting(false)
    }
  }

  async function cancel(): Promise<void> {
    if (!detail) return
    try {
      const { job } = await profileAnalysisService.cancel(detail.job.id)
      setDetail({ ...detail, job })
      toast.success('Cancelamento solicitado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível cancelar.')
    }
  }

  async function retry(): Promise<void> {
    if (!detail) return
    try {
      const { job } = await profileAnalysisService.retry(detail.job.id)
      setDetail({ analysis: null, events: [], job })
      setHistory((items) => [job, ...items])
      setProgressOpen(true)
      toast.success('Nova tentativa adicionada à fila.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível repetir.')
    }
  }

  async function approve(): Promise<void> {
    if (!detail?.analysis) return
    try {
      const parsed = JSON.parse(draftText) as unknown
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Rascunho deve ser um objeto JSON.')
      const next = await profileAnalysisService.approve(detail.job.id, parsed as Record<string, unknown>)
      setDetail(next)
      onProfileApproved?.()
      toast.success('Perfil Canônico aprovado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível aprovar o perfil.')
    }
  }

  function applyPendingAnswers(): void {
    try {
      const parsed = JSON.parse(draftText) as Record<string, unknown>
      const result = applyAnswersToProfileDraft(parsed, answers)
      setDraftText(JSON.stringify(result.document, null, 2))
      setAnswers((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !result.appliedFields.includes(field))))
      if (result.appliedFields.length > 0) toast.success(`${result.appliedFields.length} resposta(s) aplicada(s) aos fatos do perfil.`)
      if (result.errors.length > 0) toast.error(result.errors.map((item) => `${item.field}: ${item.message}`).join('\n'))
    } catch {
      toast.error('Corrija o JSON do rascunho antes de aplicar as respostas.')
    }
  }

  async function selectHistory(jobId: string): Promise<void> {
    try {
      const next = await profileAnalysisService.get(jobId)
      setDetail(next)
      setDraftText(next.analysis ? JSON.stringify(next.analysis.canonicalProfileDraft, null, 2) : '')
    } catch {
      toast.error('Não foi possível carregar esta análise.')
    }
  }

  return (
    <section className={cn('border border-border bg-card', compact ? '' : 'mt-10')}>
      {detail ? <ProfileAnalysisProgressModal events={detail.events} job={detail.job} onCancel={() => void cancel()} onOpenChange={setProgressOpen} open={progressOpen} /> : null}
      <header className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center border border-brand/30 bg-brand/10 text-brand"><FileSearch className="size-4" /></span>
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand">Análise assistida</p><h2 className="mt-1 text-sm font-semibold">Currículo → Perfil Canônico</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Rascunho com evidências, diagnóstico e revisão humana.</p></div>
        </div>
        {billing && <span className="font-mono text-[10px] text-muted-foreground">{money(billing.balanceCents, billing.currency)}</span>}
      </header>

      {billingError ? <div className="border-b border-border bg-match-partial/5 px-5 py-3 text-xs text-match-partial-foreground">Saldo temporariamente indisponível. Suas análises continuam acessíveis.</div> : null}
      {pollingError ? <div className="border-b border-border bg-match-partial/5 px-5 py-3 text-xs text-match-partial-foreground">A atualização automática perdeu conexão. Continuaremos tentando.</div> : null}

      {detail && !TERMINAL.has(detail.job.status) ? (
        <div className="p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">{STATUS_LABEL[detail.job.status]}</p><p className="mt-1 text-xs text-muted-foreground">{detail.job.currentStep ?? 'Preparando processamento'}</p></div><LoaderCircle className="size-5 animate-spin text-brand" /></div>
          <div className="mt-5 h-1.5 overflow-hidden bg-muted"><div className="h-full bg-brand transition-[width]" style={{ width: `${detail.job.progress}%` }} /></div>
          <div className="mt-3 flex items-center justify-between"><span className="font-mono text-[10px] text-muted-foreground">{detail.job.progress}%</span><div className="flex items-center gap-2"><Button onClick={() => setProgressOpen(true)} size="sm" variant="outline">Acompanhar análise</Button><Button onClick={() => void cancel()} size="sm" variant="ghost"><Square className="size-3" />Cancelar</Button></div></div>
        </div>
      ) : (
        <div className="grid gap-4 p-5">
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center border border-dashed border-border bg-background/50 p-4 text-center hover:border-brand/50">
            <FileUp className="size-5 text-brand" /><span className="mt-2 text-xs font-semibold">{file?.name ?? 'Selecionar PDF, DOCX ou TXT'}</span><span className="mt-1 text-[10px] text-muted-foreground">Até 8 MB · arquivo privado</span>
            <input accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" />
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cargos desejados<input className="mt-2 h-10 w-full border border-border bg-background px-3 text-xs normal-case tracking-normal outline-none focus:border-brand" onChange={(event) => setTargetRoles(event.target.value)} placeholder="Backend Engineer, Full Stack Engineer" value={targetRoles} /></label>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stack que quer usar<input className="mt-2 h-10 w-full border border-border bg-background px-3 text-xs normal-case tracking-normal outline-none focus:border-brand" onChange={(event) => setDesiredSkills(event.target.value)} placeholder="TypeScript, Node.js, PostgreSQL" value={desiredSkills} /></label>
          <div className="grid grid-cols-3 gap-2">
            <select className="h-10 border border-border bg-background px-2 text-xs" onChange={(event) => setFocus(event.target.value as ProfileAnalysisPreferences['focus'])} value={focus}><option value="full_stack">Full-stack</option><option value="backend">Backend</option><option value="frontend">Frontend</option><option value="ai">IA aplicada</option></select>
            <select className="h-10 border border-border bg-background px-2 text-xs" onChange={(event) => setLanguage(event.target.value as ProfileAnalysisPreferences['language'])} value={language}><option value="pt">Português</option><option value="en">English</option></select>
            <select className="h-10 border border-border bg-background px-2 text-xs" onChange={(event) => setMarkets(event.target.value as ProfileAnalysisPreferences['markets'])} value={markets}><option value="both">BR + exterior</option><option value="brazil">Brasil</option><option value="international">Exterior</option></select>
          </div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Modelo de análise<select className="mt-2 h-10 w-full border border-border bg-background px-3 text-xs normal-case tracking-normal outline-none focus:border-brand" disabled={models.length === 0} onChange={(event) => setSelectedModelId(event.target.value)} value={selectedModelId}>{models.map((model) => <option key={model.id} value={model.id}>{model.label} · {model.provider}</option>)}</select></label>
          {billing && billing.balanceCents < billing.minimumAnalysisCreditsCents ? <Link className="flex items-center justify-between border border-match-partial/30 bg-match-partial/5 p-3 text-xs text-match-partial-foreground" href="/billing"><span className="flex items-center gap-2"><WalletCards className="size-4" />Adicione créditos antes da análise.</span><ChevronRight className="size-4" /></Link> : null}
          <Button disabled={!canStart} onClick={() => void submit()}>{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Analisar currículo</Button>
        </div>
      )}

      {detail?.job.status === 'failed' || detail?.job.status === 'cancelled' ? (
        <div className="border-t border-border p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 size-4 text-match-partial" /><div><p className="text-sm font-semibold">{STATUS_LABEL[detail.job.status]}</p><p className="mt-1 text-xs text-muted-foreground">{detail.job.errorMessage ?? 'O processamento foi encerrado sem alterar seu perfil.'}</p></div></div><Button className="mt-4" onClick={() => void retry()} size="sm" variant="outline"><RefreshCw className="size-3.5" />Tentar novamente</Button></div>
      ) : null}

      {detail?.analysis ? (
        <div className="space-y-6 border-t border-border p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-brand">Resultado</p><h3 className="mt-1 text-lg font-semibold">{typeof assessment['perceived_positioning'] === 'string' ? assessment['perceived_positioning'] : 'Perfil analisado'}</h3></div><div className="flex items-center gap-2">{detail.analysis.approvedAt ? <span className="flex items-center gap-1 text-xs text-match-strong"><Check className="size-4" />Aprovado</span> : null}<div className="flex border border-border p-0.5" aria-label="Idioma do resultado"><Languages className="m-1 size-3 text-muted-foreground" />{(['pt', 'en'] as const).map((item) => <button className={cn('px-2 py-1 font-mono text-[10px] uppercase', resultLanguage === item ? 'bg-brand text-brand-foreground' : 'text-muted-foreground')} key={item} onClick={() => setResultLanguage(item)} type="button">{item}</button>)}</div></div></div>
          <div className="grid gap-4 md:grid-cols-2"><div><p className="text-xs font-semibold">Pontos fortes</p><ul className="mt-2 space-y-2 text-xs text-muted-foreground">{strengths.slice(0, 5).map((item) => <li key={item}>— {item}</li>)}</ul></div><div><p className="text-xs font-semibold">Próximos ajustes</p><ol className="mt-2 space-y-2 text-xs text-muted-foreground">{recommendations.slice(0, 5).map((item, index) => <li key={item}>{index + 1}. {item}</li>)}</ol></div></div>
          <DiffViewer className="max-w-none rounded-none shadow-none" filename="perfil atual → rascunho" lines={diff} />
          {pendingQuestions.length > 0 && <div><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-semibold">Perguntas que só você pode responder</p><p className="mt-1 text-[10px] text-muted-foreground">A IA não preenche fatos sem evidência.</p></div><Button onClick={applyPendingAnswers} size="sm" type="button" variant="outline">Aplicar respostas</Button></div><div className="mt-3 space-y-3 border-l border-match-partial pl-3">{pendingQuestions.map((item, index) => { const field = String(item['field'] ?? `question-${index}`); return <label className="block text-xs text-muted-foreground" key={`${field}-${index}`}>{String(item[resultLanguage === 'pt' ? 'question_pt' : 'question_en'] ?? item['question_pt'] ?? '')}<textarea className="mt-2 min-h-16 w-full border border-border bg-background p-2 text-xs text-foreground outline-none focus:border-brand" onChange={(event) => setAnswers((current) => ({ ...current, [field]: event.target.value }))} placeholder={resultLanguage === 'pt' ? 'Sua resposta factual' : 'Your factual answer'} value={answers[field] ?? ''} /></label> })}</div></div>}
          {evidence.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold">Evidências ({evidence.length})</summary><ul className="mt-3 space-y-2 text-xs text-muted-foreground">{evidence.slice(0, 12).map((item, index) => <li key={`${String(item['field'])}-${index}`}><span className="text-foreground">{String(item['field'] ?? '')}</span> · {String(item['excerpt_summary'] ?? '')} · {String(item['confidence'] ?? '')}</li>)}</ul></details>}
          {!detail.analysis.approvedAt && <details><summary className="cursor-pointer text-xs font-semibold">Editar rascunho avançado</summary><textarea className="mt-3 min-h-72 w-full border border-border bg-background p-3 font-mono text-[10px] leading-5 outline-none focus:border-brand" onChange={(event) => setDraftText(event.target.value)} spellCheck={false} value={draftText} /></details>}
          {!detail.analysis.approvedAt && <Button className="w-full" onClick={() => void approve()}><Check className="size-4" />Aprovar Perfil Canônico</Button>}
        </div>
      ) : null}

      {history.length > 1 && <details className="border-t border-border p-5"><summary className="cursor-pointer text-xs font-semibold">Histórico ({history.length})</summary><div className="mt-3 space-y-2">{history.map((job) => <button className="flex w-full items-center justify-between border border-border px-3 py-2 text-left text-xs hover:border-brand/50" key={job.id} onClick={() => void selectHistory(job.id)}><span className="truncate">{job.documentName}</span><span className="ml-3 shrink-0 text-muted-foreground">{STATUS_LABEL[job.status]}</span></button>)}</div></details>}
    </section>
  )
}
