import { describe, expect, it } from '@jest/globals'
import { getSafeAuthRedirect } from '@/lib/authRedirect'

describe('getSafeAuthRedirect', () => {
  it('preserva uma rota interna com query e hash', () => {
    expect(getSafeAuthRedirect('/vagas?market=international#top')).toBe('/vagas?market=international#top')
  })

  it.each([
    'https://malicioso.example/roubar-sessao',
    '//malicioso.example/roubar-sessao',
    '/auth/callback?code=vazado',
    'javascript:alert(1)',
  ])('rejeita destino inseguro: %s', (destination) => {
    expect(getSafeAuthRedirect(destination)).toBe('/')
  })

  it('remove parametros OAuth que nao devem voltar ao dashboard', () => {
    expect(getSafeAuthRedirect('/?market=br&code=segredo&state=estado')).toBe('/?market=br')
  })
})
