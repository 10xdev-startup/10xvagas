import { beforeEach, describe, expect, it } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ProfileAnalysisPanel } from '@/components/ProfileAnalysisPanel'
import { billingService } from '@/services/billingService'
import { profileAnalysisService } from '@/services/profileAnalysisService'
import type { ProfileAnalysisJob } from '@/types/profileAnalysis'

declare const jest: typeof import('@jest/globals').jest

jest.mock('../services/billingService', () => ({ billingService: { status: jest.fn() } }))
jest.mock('../services/profileAnalysisService', () => ({
  profileAnalysisService: {
    approve: jest.fn(),
    cancel: jest.fn(),
    create: jest.fn(),
    get: jest.fn(),
    list: jest.fn(),
    retry: jest.fn(),
  },
}))

function job(status: ProfileAnalysisJob['status'] = 'queued'): ProfileAnalysisJob {
  return {
    attemptCount: 0,
    cancelRequestedAt: null,
    createdAt: '2026-08-03T12:00:00.000Z',
    currentStep: 'Aguardando processamento',
    documentMimeType: 'text/plain',
    documentName: 'cv.txt',
    errorCode: null,
    errorMessage: null,
    finishedAt: null,
    id: 'job-1',
    modelId: 'gpt-5.6-terra',
    preferences: { desiredSkills: [], focus: 'backend', language: 'pt', markets: 'both', targetRoles: [] },
    progress: 0,
    retryOfJobId: null,
    startedAt: null,
    status,
    updatedAt: '2026-08-03T12:00:00.000Z',
  }
}

describe('ProfileAnalysisPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(profileAnalysisService.list).mockResolvedValue({ jobs: [] })
  })

  it('mantem upload bloqueado e orienta recarga quando nao ha saldo', async () => {
    jest.mocked(billingService.status).mockResolvedValue({ balanceCents: 0, checkoutEnabled: false, currency: 'BRL', hasCustomer: true, minimumAnalysisCreditsCents: 5, packs: [] })

    render(<ProfileAnalysisPanel />)

    expect(await screen.findByText(/adicione créditos antes da análise/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /analisar currículo/i })).toBeDisabled()
  })

  it('envia o arquivo e troca imediatamente para o estado de fila', async () => {
    jest.mocked(billingService.status).mockResolvedValue({ balanceCents: 1000, checkoutEnabled: false, currency: 'BRL', hasCustomer: true, minimumAnalysisCreditsCents: 5, packs: [] })
    jest.mocked(profileAnalysisService.create).mockResolvedValue({ job: job() })

    const { container } = render(<ProfileAnalysisPanel />)
    await screen.findByText(/R\$\s*10,00/)
    const document = new File(['curriculo'], 'cv.txt', { type: 'text/plain' })
    const input = container.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
    fireEvent.change(input as HTMLInputElement, { target: { files: [document] } })
    fireEvent.click(screen.getByRole('button', { name: /analisar currículo/i }))

    await waitFor(() => expect(profileAnalysisService.create).toHaveBeenCalledWith(
      document,
      expect.objectContaining({ focus: 'full_stack', language: 'pt', markets: 'both' }),
    ))
    expect(await screen.findByText('Na fila')).toBeInTheDocument()
  })
})
