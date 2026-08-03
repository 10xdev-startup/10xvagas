'use client'

import { useEffect, useState } from 'react'
import { ArrowUpRight, CircleDollarSign, Coins, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { billingService, type BillingStatus } from '@/services/billingService'

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(amountCents / 100)
}

export function BillingWorkspace() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    billingService.status()
      .then((data) => {
        if (active) setStatus(data)
      })
      .catch(() => toast.error('Não foi possível carregar seus créditos.'))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function startCheckout(lookupKey: string): Promise<void> {
    try {
      setCheckoutKey(lookupKey)
      const { url } = await billingService.checkout(lookupKey)
      window.location.assign(url)
    } catch {
      toast.error('Não foi possível abrir o checkout da Stripe.')
      setCheckoutKey(null)
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <section className="relative overflow-hidden border border-border bg-card p-6 md:p-8">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-brand/10 to-transparent" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-5 flex size-11 items-center justify-center border border-brand/25 bg-brand/10 text-brand">
              <Coins className="size-5" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand">Créditos de inteligência</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">Você controla o investimento.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              Créditos são usados apenas nas tarefas de IA, como análise de match, adaptação de currículo e respostas de candidatura.
            </p>
          </div>
          <div className="min-w-56 border border-border bg-background/70 p-5 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Saldo disponível</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-foreground">
              {loading ? '—' : formatMoney(status?.balanceCents ?? 0, status?.currency ?? 'BRL')}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-3.5 text-match-strong" /> Cobrança processada pela Stripe
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recarga avulsa</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">Escolha um pacote</h2>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">Sem assinatura e sem renovação automática.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(status?.packs ?? []).map((pack, index) => (
            <article key={pack.lookupKey} className="group border border-border bg-card p-5 transition-colors hover:border-brand/50">
              <div className="flex items-center justify-between">
                <CircleDollarSign className="size-5 text-brand" />
                {index === 1 && (
                  <span className="border border-signal/25 bg-signal/10 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-signal">Para começar</span>
                )}
              </div>
              <p className="mt-7 font-mono text-2xl font-semibold text-foreground">
                {formatMoney(pack.amountCents, pack.currency)}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Saldo integral para tarefas inteligentes do seu pipeline.</p>
              <Button
                className="mt-5 w-full justify-between"
                disabled={checkoutKey !== null}
                onClick={() => void startCheckout(pack.lookupKey)}
                variant={index === 1 ? 'default' : 'outline'}
              >
                {checkoutKey === pack.lookupKey ? 'Abrindo Stripe…' : 'Adicionar créditos'}
                <ArrowUpRight className="size-4" />
              </Button>
            </article>
          ))}
        </div>

        {!loading && status?.packs.length === 0 && (
          <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-border bg-card/40 p-8 text-center">
            <Sparkles className="size-6 text-brand" />
            <p className="mt-3 text-sm font-semibold text-foreground">Pacotes ainda não publicados neste ambiente.</p>
            <p className="mt-1 text-xs text-muted-foreground">O restante do 10xVagas continua disponível normalmente.</p>
          </div>
        )}
      </section>
    </main>
  )
}
