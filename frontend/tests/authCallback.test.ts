import { describe, expect, it } from '@jest/globals'
import { getAuthCallbackDestination, getAuthCallbackOrigin } from '@/lib/authCallback'

describe('getAuthCallbackOrigin', () => {
  it('prioriza a URL publica configurada em producao', () => {
    expect(getAuthCallbackOrigin(
      'http://localhost:8080/auth/callback?code=oauth-code',
      'https://web-frontend-10xvagas.azurewebsites.net',
    )).toBe('https://web-frontend-10xvagas.azurewebsites.net')
  })

  it('usa a origem da requisicao quando nao ha configuracao valida', () => {
    expect(getAuthCallbackOrigin('http://localhost:3000/auth/callback', 'url-invalida'))
      .toBe('http://localhost:3000')
  })
})

describe('getAuthCallbackDestination', () => {
  it('recupera o destino salvo no cookie pelo inicio do OAuth', () => {
    expect(getAuthCallbackDestination(null, '%2Fvaga%2Fabc%3Forigem%3Dgoogle'))
      .toBe('/vaga/abc?origem=google')
  })

  it('mantem compatibilidade com o redirect da query', () => {
    expect(getAuthCallbackDestination('/saved', '%2Fdashboard')).toBe('/saved')
  })

  it('nao decodifica novamente um redirect que ja veio da query', () => {
    expect(getAuthCallbackDestination('/dashboard?next=%2Fsaved', null))
      .toBe('/dashboard?next=%2Fsaved')
  })

  it('rejeita redirects externos', () => {
    expect(getAuthCallbackDestination(null, 'https%3A%2F%2Fmalicioso.example'))
      .toBe('/dashboard')
  })
})
