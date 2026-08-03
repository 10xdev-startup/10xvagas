'use client'

import { usePathname } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { ThemeToggle } from '@/components/showcase/blocks/ThemeToggle'
import { SidebarTrigger } from '@/components/ui/sidebar'

const ROUTES: Record<string, { eyebrow: string; title: string }> = {
  '/dashboard': { eyebrow: 'Descoberta', title: 'Radar' },
  '/saved': { eyebrow: 'Decisão', title: 'Vagas salvas' },
  '/profile': { eyebrow: 'Inteligência', title: 'Perfil Canônico' },
  '/sources': { eyebrow: 'Operação', title: 'Fontes' },
}

export function DashboardHeader() {
  const pathname = usePathname()
  const route = ROUTES[pathname] ?? { eyebrow: '10xVagas', title: 'Workspace' }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <SidebarTrigger className="-ml-1" />
        <div className="hidden h-5 w-px bg-border sm:block" />
        <div className="min-w-0">
          <p className="hidden text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground sm:block">{route.eyebrow}</p>
          <p className="truncate text-xs font-semibold text-foreground">{route.title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-2 border-r border-border pr-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground md:flex">
          <ShieldCheck className="size-3.5 text-match-strong" />workspace protegido
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
