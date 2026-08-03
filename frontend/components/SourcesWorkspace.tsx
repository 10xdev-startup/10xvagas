'use client'

import { useCallback, useEffect, useState } from 'react'
import { LoaderCircle, RotateCcw } from 'lucide-react'
import { SourcesLedger } from '@/components/SourcesLedger'
import { Button } from '@/components/ui/button'
import { jobService } from '@/services/jobService'
import type { SourceStatus } from '@/types/job'

export function SourcesWorkspace() {
  const [sources, setSources] = useState<SourceStatus[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setFailed(false)
    setSources(null)
    void jobService.list()
      .then((data) => setSources(data.sources))
      .catch(() => setFailed(true))
  }, [])

  useEffect(() => {
    void jobService.list()
      .then((data) => setSources(data.sources))
      .catch(() => setFailed(true))
  }, [])

  if (sources) return <SourcesLedger sources={sources} />
  return <main className="mx-auto flex min-h-[520px] w-full max-w-[1450px] items-center justify-center border border-border bg-card p-8"><div className="text-center">{failed ? <><p className="text-sm font-semibold">As fontes não responderam.</p><Button className="mt-4" onClick={load} variant="outline"><RotateCcw />Tentar novamente</Button></> : <><LoaderCircle className="mx-auto size-6 animate-spin text-brand" /><p className="mt-3 text-sm font-medium">Lendo o estado das fontes</p></>}</div></main>
}
