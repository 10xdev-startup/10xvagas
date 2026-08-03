"use client"

import React, { useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TenXVagasLogo } from '@/components/TenXVagasLogo'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar } from '@/components/ui/sidebar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Bookmark, Check, ChevronUp, DatabaseZap, LogOut, Maximize2, Minimize2, MousePointerClick, PanelLeft, ScanSearch, UserRound } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useSavedJobs } from '@/lib/savedJobsStore'

type SidebarMode = 'expanded' | 'collapsed' | 'hover'

const NAV_ITEMS = [
  { href: '/dashboard', title: 'Radar', icon: ScanSearch },
  { href: '/saved', title: 'Vagas salvas', icon: Bookmark },
  { href: '/profile', title: 'Perfil Canônico', icon: UserRound },
  { href: '/sources', title: 'Fontes', icon: DatabaseZap },
]

const SIDEBAR_MODE_KEY = 'sidebar-mode'
const SIDEBAR_MODE_EVENT = 'sidebar-mode-change'

function readSidebarMode(): SidebarMode {
  const stored = localStorage.getItem(SIDEBAR_MODE_KEY)
  return stored === 'collapsed' || stored === 'hover' ? stored : 'expanded'
}

function subscribeSidebarMode(callback: () => void): () => void {
  window.addEventListener(SIDEBAR_MODE_EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(SIDEBAR_MODE_EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

// Lê o modo persistido sem causar hydration mismatch. O snapshot do server é
// sempre 'expanded', então a primeira renderização do client é idêntica à do
// server; o valor salvo é aplicado logo após a hidratação. Usa useSyncExternalStore
// (em vez de useState + effect) por ser a forma idiomática de ler um sistema
// externo e por não cair na regra react-hooks/set-state-in-effect.
function usePersistedSidebarMode() {
  const mode = React.useSyncExternalStore(
    subscribeSidebarMode,
    readSidebarMode,
    () => 'expanded' as SidebarMode
  )
  const setMode = React.useCallback((next: SidebarMode) => {
    localStorage.setItem(SIDEBAR_MODE_KEY, next)
    window.dispatchEvent(new Event(SIDEBAR_MODE_EVENT))
  }, [])
  return [mode, setMode] as const
}

// false no server e na primeira renderização do client; true após a hidratação.
// Usado para adiar a montagem do DropdownMenu (que gera ids do Radix) para depois
// do hydrate — no primeiro paint server e client renderizam o mesmo botão simples,
// então não há id divergente e o hydration mismatch desaparece.
const noopSubscribe = () => () => {}
function useHydrated() {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false)
}

function AppSidebar() {
  const router    = useRouter()
  const pathname  = usePathname()
  const { setOpen, setOpenMobile, isMobile } = useSidebar()
  const { user, signOut } = useAuth()
  const savedJobs = useSavedJobs()

  const hydrated = useHydrated()
  const [sidebarMode, setSidebarMode] = usePersistedSidebarMode()

  const prevModeRef = useRef<string | null>('expanded')

  useEffect(() => {
    if (prevModeRef.current === sidebarMode) return
    prevModeRef.current = sidebarMode
    if (isMobile) return
    setOpen(sidebarMode === 'expanded')
  }, [sidebarMode, setOpen, isMobile])

  const leaveTimeoutRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownOpenRef  = useRef(false)

  const handleEnter = React.useCallback(() => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current)
    setOpen(true)
  }, [setOpen])

  const handleLeave = React.useCallback(() => {
    if (dropdownOpenRef.current) return
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current)
    leaveTimeoutRef.current = setTimeout(() => setOpen(false), 300)
  }, [setOpen])

  const handleDropdownChange = React.useCallback((open: boolean) => {
    dropdownOpenRef.current = open
    if (!open && sidebarMode === 'hover' && !isMobile) {
      if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current)
      leaveTimeoutRef.current = setTimeout(() => setOpen(false), 400)
    }
  }, [sidebarMode, isMobile, setOpen])

  useEffect(() => () => {
    if (leaveTimeoutRef.current) clearTimeout(leaveTimeoutRef.current)
  }, [])

  const appName = useMemo(
    () => process.env['NEXT_PUBLIC_APP_NAME'] || '10xVagas',
    []
  )

  const userName = typeof user?.user_metadata?.full_name === 'string'
    ? user.user_metadata.full_name
    : typeof user?.user_metadata?.name === 'string'
      ? user.user_metadata.name
      : user?.email?.split('@')[0] ?? 'Minha conta'

  async function handleSignOut(): Promise<void> {
    try {
      await signOut()
      router.replace('/login')
      router.refresh()
    } catch {
      toast.error('Nao foi possivel sair. Tente novamente.')
    }
  }

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={sidebarMode === 'hover' && !isMobile ? handleEnter : undefined}
      onMouseLeave={sidebarMode === 'hover' && !isMobile ? handleLeave : undefined}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex size-9 shrink-0 items-center justify-center border border-brand/25 bg-brand/[0.06] text-brand">
                <TenXVagasLogo className="size-7" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{appName}</span>
                <span className="truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">job intelligence</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="overflow-y-hidden">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    aria-current={pathname === item.href ? 'page' : undefined}
                    onClick={() => { router.push(item.href); if (isMobile) setOpenMobile(false) }}
                    isActive={pathname === item.href}
                    tooltip={item.title}
                  >
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                    {item.href === '/saved' && savedJobs.jobs.length > 0 && <span className="ml-auto min-w-5 border border-sidebar-border bg-sidebar-accent px-1 text-center font-mono text-[9px] text-sidebar-foreground">{savedJobs.jobs.length}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {hydrated ? (
              <DropdownMenu onOpenChange={handleDropdownChange}>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="border border-sidebar-border bg-sidebar-accent/50">
                    <div className="flex size-8 shrink-0 items-center justify-center border border-brand/25 bg-brand/10 text-brand">
                      <UserRound className="size-4" />
                    </div>
                    <div className="grid min-w-0 flex-1 text-left leading-tight">
                      <span className="truncate text-xs font-semibold">{userName}</span>
                      <span className="truncate text-[10px] text-muted-foreground">{user?.email ?? 'Sessao ativa'}</span>
                    </div>
                    <ChevronUp className="ml-auto size-3.5 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="w-60">
                  <DropdownMenuLabel className="font-normal">
                    <span className="block truncate text-sm font-semibold">{userName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 size-4" />
                    Sair do 10xVagas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <SidebarMenuButton size="lg"><UserRound className="size-4" /></SidebarMenuButton>
            )}
          </SidebarMenuItem>
          <SidebarMenuItem>
            {!hydrated ? (
              <SidebarMenuButton className="text-muted-foreground hover:text-foreground">
                <PanelLeft className="size-4" />
              </SidebarMenuButton>
            ) : (
            <DropdownMenu onOpenChange={handleDropdownChange}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="text-muted-foreground hover:text-foreground">
                  <PanelLeft className="size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-48">
                <DropdownMenuItem onClick={() => setSidebarMode('expanded')}>
                  <Maximize2 className="size-4 mr-2" />
                  Expandido
                  {sidebarMode === 'expanded' && <Check className="ml-auto size-4 text-brand" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSidebarMode('collapsed')}>
                  <Minimize2 className="size-4 mr-2" />
                  Recolhido
                  {sidebarMode === 'collapsed' && <Check className="ml-auto size-4 text-brand" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSidebarMode('hover')}>
                  <MousePointerClick className="size-4 mr-2" />
                  Expandir ao passar
                  {sidebarMode === 'hover' && <Check className="ml-auto size-4 text-brand" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {sidebarMode === 'hover' && <SidebarRail />}
    </Sidebar>
  )
}

export default React.memo(AppSidebar)
