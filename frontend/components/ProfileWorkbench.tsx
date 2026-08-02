'use client'

import { useState } from 'react'
import { Clipboard, Code2, FileText, Languages, MapPin, ShieldCheck, Sparkles, Target, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { CanonicalProfile } from '@/lib/profile'
import { cn } from '@/lib/utils'
import { SearchPreferencesPanel } from '@/components/SearchPreferencesPanel'

function humanize(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }

export function ProfileWorkbench({ profile }: { profile: CanonicalProfile }) {
  const [language, setLanguage] = useState<'pt' | 'en'>('pt')
  const completion = Math.round((1 - profile.facts_pending_confirmation.length / (profile.facts_pending_confirmation.length + 30)) * 100)
  const command = 'npm run profile:import -- --input /caminho/curriculo.pdf --input /caminho/portfolio/src/data --use-codex'

  async function copyCommand() { await navigator.clipboard.writeText(command); toast.success('Comando copiado.') }

  return (
    <main className="mx-auto w-full max-w-[1500px] pb-12">
      <header className="grid gap-7 border-b border-border/70 pb-7 pt-2 lg:grid-cols-[1fr_auto] lg:items-end">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Chave de matching</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] md:text-5xl">Seu perfil não é um currículo.<br /><span className="font-normal text-muted-foreground">É uma regra de decisão.</span></h1><p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">O motor compara vagas apenas com o que você quer usar — suporte e helpdesk continuam como histórico, nunca como intenção.</p></div>
        <div className="flex items-end gap-5 border-l border-border pl-5"><div><p className="font-mono text-3xl font-semibold">{completion}%</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">completo</p></div><div className="h-12 w-px bg-border" /><div><p className="font-mono text-3xl font-semibold">{profile.facts_pending_confirmation.length}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">pendências</p></div></div>
      </header>

      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
        <div className="space-y-6">
          <article className="border border-border bg-card p-6 md:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row"><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Identidade profissional</p><h2 className="mt-2 text-2xl font-semibold">{profile.identity.full_name}</h2><p className="mt-2 text-sm text-secondary-foreground">{profile.identity.headline[language]}</p><p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" />{profile.identity.location.city}, {profile.identity.location.state}</p></div><div className="flex h-fit border border-border p-0.5">{(['pt','en'] as const).map((value) => <button className={cn('px-3 py-2 text-[10px] font-semibold uppercase', language === value ? 'bg-foreground text-background' : 'text-muted-foreground')} key={value} onClick={() => setLanguage(value)}>{value}</button>)}</div></div></article>

          <article className="border border-border bg-card"><header className="flex items-center gap-3 border-b border-border p-5"><Target className="size-4 text-brand" /><div><h2 className="text-sm font-semibold">Stack que entra no matching</h2><p className="text-xs text-muted-foreground">Prioridade 3 pesa mais; prioridade 1 é complementar.</p></div></header><div className="flex flex-wrap gap-2 p-5">{profile.skills_desired.toSorted((a,b) => b.priority-a.priority).map((skill) => <span className={cn('border px-2.5 py-1.5 text-xs', skill.priority === 3 ? 'border-brand/35 bg-brand/10 text-brand' : 'border-border bg-muted/30 text-secondary-foreground')} key={skill.name}>{skill.name}<sup className="ml-1 font-mono text-[8px] opacity-60">{skill.priority}</sup></span>)}</div></article>

          <div className="grid gap-6 md:grid-cols-2"><article className="border border-border bg-card p-5"><div className="flex items-center gap-2"><ShieldCheck className="size-4 text-match-strong" /><h2 className="text-sm font-semibold">Evidenciado</h2></div><div className="mt-4 flex flex-wrap gap-x-3 gap-y-2">{profile.skills_known.desired_and_evidenced.slice(0,24).map((skill) => <span className="text-xs text-secondary-foreground" key={skill}>{skill}</span>)}</div></article><article className="border border-border bg-card p-5"><div className="flex items-center gap-2"><TriangleAlert className="size-4 text-match-partial" /><h2 className="text-sm font-semibold">Conheço, mas não quero buscar</h2></div><p className="mt-2 text-xs leading-5 text-muted-foreground">Este bloco fica fora do embedding e evita o falso positivo de suporte.</p><div className="mt-4 flex flex-wrap gap-2">{profile.skills_known.known_but_not_desired_for_matching.map((skill) => <span className="border border-border px-2 py-1 text-[10px] text-muted-foreground line-through decoration-border" key={skill}>{skill}</span>)}</div></article></div>

          <article className="border border-border bg-card"><header className="border-b border-border p-5"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Trajetória usada como evidência</p></header>{profile.experience.map((item) => <div className="grid gap-3 border-b border-border/60 p-5 last:border-0 md:grid-cols-[145px_1fr]" key={`${item.company}-${item.start_date}`}><div><p className="font-mono text-[10px] text-muted-foreground">{item.start_date} — {item.current ? 'agora' : item.end_date}</p><p className="mt-1 text-xs text-muted-foreground">{item.location}</p></div><div><h3 className="text-sm font-semibold">{item.role[language]}</h3><p className="mt-1 text-xs text-brand">{item.company}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{item.highlights[language]?.[0]}</p></div></div>)}</article>
        </div>

        <aside className="space-y-6">
          <SearchPreferencesPanel />
          <article className="border border-brand/25 bg-brand/[0.045] p-5"><div className="flex items-center gap-2"><Sparkles className="size-4 text-brand" /><h2 className="text-sm font-semibold">Importar com Codex CLI</h2></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Rode localmente: o CV e o portfólio viram um rascunho estruturado. Nada é enviado pelo navegador.</p><div className="mt-4 border border-border bg-background p-3"><code className="break-all font-mono text-[10px] leading-5 text-secondary-foreground">{command}</code></div><button className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-brand" onClick={copyCommand}><Clipboard className="size-3.5" />Copiar comando</button></article>
          <article className="border border-border bg-card p-5"><div className="flex items-center gap-2"><FileText className="size-4 text-brand" /><h2 className="text-sm font-semibold">Busca atual</h2></div><dl className="mt-5 space-y-4 text-xs"> <div><dt className="text-muted-foreground">Cargos</dt><dd className="mt-1 text-secondary-foreground">{profile.work_preferences.target_roles.map(humanize).join(' · ')}</dd></div><div><dt className="text-muted-foreground">Modelos</dt><dd className="mt-1 text-secondary-foreground">Remoto + híbrido em BH e região metropolitana</dd></div><div><dt className="text-muted-foreground">Mercados</dt><dd className="mt-1 text-secondary-foreground">Brasil + exterior remoto</dd></div></dl></article>
          <article className="border border-border bg-card p-5"><div className="flex items-center gap-2"><Code2 className="size-4 text-match-partial" /><h2 className="text-sm font-semibold">Decisões pendentes</h2></div><ol className="mt-4 space-y-4">{profile.facts_pending_confirmation.map((fact,index) => <li className="flex gap-3 text-xs leading-5 text-muted-foreground" key={fact.question_pt}><span className="font-mono text-[9px] text-match-partial-foreground">{String(index+1).padStart(2,'0')}</span>{fact.question_pt}</li>)}</ol></article>
          <article className="flex items-start gap-3 border border-border p-5"><Languages className="mt-0.5 size-4 text-brand" /><p className="text-xs leading-5 text-muted-foreground">Narrativas e experiências já estão disponíveis em português e inglês para CVs internacionais.</p></article>
        </aside>
      </section>
    </main>
  )
}
