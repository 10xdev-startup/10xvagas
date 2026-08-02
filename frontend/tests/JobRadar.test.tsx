import { describe, expect, it } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react'
import { JobRadar } from '@/components/JobRadar'
import type { RadarJob, SourceStatus } from '@/lib/experiment'

declare const jest: typeof import('@jest/globals').jest

const toggleSaved = jest.fn(() => true)
jest.mock('../lib/savedJobsStore', () => ({
  useSavedJobs: () => ({ jobs: [], isSaved: () => false, save: jest.fn(), remove: jest.fn(), toggle: toggleSaved }),
}))

const jobs: RadarJob[] = [
  {
    id: 'br-1',
    market: 'brazil',
    company: 'Empresa Brasil',
    title: 'Desenvolvedor Full Stack',
    source: 'lever',
    sourceLabel: 'Lever',
    sourceUrl: 'https://example.com/br-1',
    applyUrl: null,
    description: 'Descrição completa da vaga brasileira.',
    location: 'Belo Horizonte',
    workplaceType: 'hybrid',
    employmentType: 'clt',
    salary: 'R$ 8.000',
    publishedAt: '2026-08-01T10:00:00Z',
    score: 88,
    rank: 1,
    reasons: ['Stack alinhada.'],
    gaps: [],
    skills: ['TypeScript', 'React'],
    status: 'matched',
  },
  {
    id: 'int-1',
    market: 'international',
    company: 'Remote Company',
    title: 'Software Engineer',
    source: 'ashby',
    sourceLabel: 'Ashby',
    sourceUrl: 'https://example.com/int-1',
    applyUrl: 'https://example.com/int-1/apply',
    description: 'Full international job description.',
    location: 'LATAM',
    workplaceType: 'remote',
    employmentType: 'FullTime',
    salary: 'USD 80k',
    publishedAt: '2026-08-01T11:00:00Z',
    score: null,
    rank: null,
    reasons: [],
    gaps: [],
    skills: [],
    status: 'new',
  },
]

const sources: SourceStatus[] = [
  { id: 'lever', label: 'Lever', mode: 'automatic', status: 'ok', count: 1 },
  { id: 'linkedin', label: 'LinkedIn', mode: 'assisted', status: 'assisted', count: 0 },
]

describe('JobRadar', () => {
  it('troca mercado e dossie sem sair da pagina', () => {
    render(<JobRadar brazilCount={1} internationalCount={1} jobs={jobs} sources={sources} />)

    expect(screen.getByText('Descrição completa da vaga brasileira.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Exterior 1/i }))

    expect(screen.getByText('Full international job description.')).toBeInTheDocument()
    expect(screen.getByText('aguardando análise', { exact: false })).toBeInTheDocument()
  })

  it('salva uma oportunidade sem abrir outra rota', () => {
    render(<JobRadar brazilCount={1} internationalCount={1} jobs={jobs} sources={sources} />)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar Desenvolvedor Full Stack' }))
    expect(toggleSaved).toHaveBeenCalledWith(jobs[0])
  })

  it('busca por tecnologia e preserva apenas a vaga correspondente', () => {
    render(<JobRadar brazilCount={1} internationalCount={1} jobs={jobs} sources={sources} />)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar vagas' }), {
      target: { value: 'React' },
    })

    expect(screen.getAllByText('Desenvolvedor Full Stack')).toHaveLength(2)
    expect(screen.queryByText('Software Engineer')).not.toBeInTheDocument()
  })
})
