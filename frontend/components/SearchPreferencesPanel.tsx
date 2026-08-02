'use client'

import Link from 'next/link'
import { MapPinned, RotateCcw, ScanSearch } from 'lucide-react'
import { useSearchPreferences, type SearchPreferences } from '@/lib/searchPreferencesStore'
import { cn } from '@/lib/utils'

const OPTIONS: Array<{ key: keyof Pick<SearchPreferences, 'brazilRemote' | 'bhHybrid' | 'internationalRemote'>; title: string; detail: string }> = [
  { key: 'brazilRemote', title: 'Brasil remoto', detail: 'Vagas remotas em todo o país' },
  { key: 'bhHybrid', title: 'BH + região híbrido', detail: 'Híbridas em Belo Horizonte e RMBH' },
  { key: 'internationalRemote', title: 'Exterior remoto', detail: 'Oportunidades internacionais remotas' },
]

export function SearchPreferencesPanel() {
  const { preferences, update, reset } = useSearchPreferences()
  return (
    <article className="border border-border bg-card"><header className="flex items-center justify-between border-b border-border p-5"><div className="flex items-center gap-2"><MapPinned className="size-4 text-brand" /><div><h2 className="text-sm font-semibold">Mudar o alcance da busca</h2><p className="text-xs text-muted-foreground">A alteração entra no Radar imediatamente.</p></div></div><button aria-label="Restaurar busca padrão" className="flex size-9 items-center justify-center text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={reset}><RotateCcw className="size-3.5" /></button></header><div className="divide-y divide-border/60">{OPTIONS.map((option) => { const active = preferences[option.key]; return <button aria-pressed={active} className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-muted/30" key={option.key} onClick={() => update({ [option.key]: !active })}><span><span className="block text-xs font-semibold text-foreground">{option.title}</span><span className="mt-1 block text-[10px] text-muted-foreground">{option.detail}</span></span><span className={cn('h-5 w-9 border p-0.5 transition', active ? 'border-brand bg-brand' : 'border-border bg-muted')}><span className={cn('block size-3.5 bg-background transition-transform', active && 'translate-x-3.5')} /></span></button> })}</div><div className="border-t border-border p-4"><label className="flex items-center justify-between gap-4 text-xs text-muted-foreground"><span>Score mínimo das analisadas</span><select className="h-9 border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring" onChange={(event) => update({ minScore: Number(event.target.value) })} value={preferences.minScore}><option value={0}>Todos</option><option value={60}>60+</option><option value={70}>70+</option><option value={80}>80+</option></select></label><Link className="mt-4 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-brand" href="/"><ScanSearch className="size-3.5" />Ver resultado no Radar</Link></div></article>
  )
}
