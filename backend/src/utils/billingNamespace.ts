export const BILLING_NAMESPACE = '10xvagas' as const

export interface BillingMetadata {
  platform?: string
  product?: string
}

/**
 * O 10xVagas nao possui checkout legado. Por isso o webhook falha fechado:
 * ambos os marcadores precisam existir e apontar para este produto.
 */
export function belongsToBillingNamespace(metadata: BillingMetadata | null): boolean {
  return metadata?.product === BILLING_NAMESPACE
    && metadata.platform === BILLING_NAMESPACE
}

export function namespacedMeterEventName(eventName: string): string {
  return `${BILLING_NAMESPACE}_${eventName}`
}
