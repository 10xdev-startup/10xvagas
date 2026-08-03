import { describe, expect, it } from '@jest/globals'
import { buildPublicId, normalizeSlugText, parsePublicId, publicIdSuffix } from '@/lib/urlSlug'

describe('normalizeSlugText', () => {
  it('remove acentos, caixa e pontuacao', () => {
    expect(normalizeSlugText('Desenvolvedor Full-Stack Sênior')).toBe('desenvolvedor-full-stack-senior')
  })

  it('colapsa separadores repetidos e apara as pontas', () => {
    expect(normalizeSlugText('  ---Acme   //  Corp!!! ')).toBe('acme-corp')
  })

  it('devolve vazio quando nada sobra apos normalizar', () => {
    expect(normalizeSlugText('***')).toBe('')
    expect(normalizeSlugText('日本語')).toBe('')
  })
})

describe('buildPublicId', () => {
  it('faz round-trip da forma canonica', () => {
    const id = buildPublicId('ashby:563cb60e-1471-4c8d-865c-d21eec081645', ['Senior Software Engineer', 'RevenueCat'])
    expect(id).toBe(`senior-software-engineer-revenuecat-${publicIdSuffix('ashby:563cb60e-1471-4c8d-865c-d21eec081645')}`)
    expect(parsePublicId(id)?.suffix).toBe(publicIdSuffix('ashby:563cb60e-1471-4c8d-865c-d21eec081645'))
  })

  it('cai para so o sufixo quando o decorativo normaliza vazio', () => {
    const id = buildPublicId('BR-001', ['***'])
    expect(id).toBe(publicIdSuffix('BR-001'))
    expect(parsePublicId(id)).toEqual({ suffix: publicIdSuffix('BR-001'), decorative: '' })
  })

  it('trunca decorativo longo na fronteira do separador', () => {
    const id = buildPublicId('BR-002', ['Engenheiro de Software Muito Especializado em Sistemas Distribuidos e Observabilidade', 'Empresa'])
    const parsed = parsePublicId(id)
    expect(parsed).not.toBeNull()
    expect(parsed!.decorative.length).toBeLessThanOrEqual(60)
    expect(parsed!.decorative.endsWith('-')).toBe(false)
  })

  it('o sufixo depende so da identidade interna, nao do decorativo', () => {
    const a = buildPublicId('BR-003', ['Titulo Antigo'])
    const b = buildPublicId('BR-003', ['Titulo Renomeado Na Fonte'])
    expect(parsePublicId(a)!.suffix).toBe(parsePublicId(b)!.suffix)
  })
})

describe('parsePublicId', () => {
  it('rejeita entrada vazia ou malformada antes de qualquer lookup', () => {
    expect(parsePublicId('')).toBeNull()
    expect(parsePublicId('   ')).toBeNull()
    expect(parsePublicId('sem-sufixo')).toBeNull()
    expect(parsePublicId('vaga-ZZZZZZZZZZ')).toBeNull()
    expect(parsePublicId('vaga--a1b2c3d4e5')).toBeNull()
  })

  it('nao confunde UUID cru com sufixo valido', () => {
    // O ultimo grupo do UUID tem 12 hex; sem checar a fronteira, os 10 finais
    // passariam como sufixo.
    expect(parsePublicId('563cb60e-1471-4c8d-865c-d21eec081645')).toBeNull()
  })

  it('rejeita comprimento imediatamente abaixo e acima do sufixo valido', () => {
    expect(parsePublicId('vaga-a1b2c3d4e')).toBeNull()
    expect(parsePublicId('vaga-a1b2c3d4e5f')).toBeNull()
    expect(parsePublicId('vaga-a1b2c3d4e5')).toEqual({ suffix: 'a1b2c3d4e5', decorative: 'vaga' })
  })

  it('rejeita decorativo acima do limite', () => {
    expect(parsePublicId(`${'a'.repeat(61)}-a1b2c3d4e5`)).toBeNull()
  })
})
