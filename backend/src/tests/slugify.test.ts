import { describe, expect, it } from '@jest/globals'
import { extractSlugPrefix, isUUID, makeSlug, slugPrefixToUUIDRange, slugify } from '@/utils/slugify'

const UUID = 'abc12345-6789-4abc-8def-0123456789ab'

describe('slugify', () => {
  it('normaliza acentos, caixa, espacos e simbolos', () => {
    expect(slugify('Engenheiro de Software — São Paulo')).toBe('engenheiro-de-software-sao-paulo')
  })

  it('limita a parte decorativa a 60 caracteres', () => {
    expect(slugify('a'.repeat(80))).toHaveLength(60)
  })

  it('nao deixa hifen pendurado quando o corte cai na fronteira', () => {
    const slug = makeSlug(`${'a'.repeat(59)} palavra`, UUID)
    expect(slug).toBe(`${'a'.repeat(59)}-abc123`)
    expect(extractSlugPrefix(slug)).toBe('abc123')
  })

  it('gera slug com o prefixo da identidade UUID', () => {
    expect(makeSlug('Backend Engineer', UUID)).toBe('backend-engineer-abc123')
  })

  it('recusa gerar slug para identidade nao canonica', () => {
    expect(() => makeSlug('Backend Engineer', 'lever:42')).toThrow('UUID')
  })

  it('reconhece UUID sem confundir slug', () => {
    expect(isUUID(UUID)).toBe(true)
    expect(isUUID('backend-engineer-abc123')).toBe(false)
  })

  it.each([
    ['backend-engineer-abc123', 'abc123'],
    ['abc123', 'abc123'],
    ['BACKEND-ENGINEER-ABC123', 'abc123'],
  ])('extrai prefixo apenas de uma gramatica completa: %s', (value, expected) => {
    expect(extractSlugPrefix(value)).toBe(expected)
  })

  it.each([
    UUID,
    'backend-engineer-abc12',
    'backend--engineer-abc123',
    '-backend-abc123',
    `backend-${'a'.repeat(61)}-abc123`,
    'backend-engineer-zzzzzz',
  ])('rejeita valor malformado antes do lookup: %s', (value) => {
    expect(extractSlugPrefix(value)).toBeNull()
  })

  it('converte prefixo em range UUID nativo', () => {
    expect(slugPrefixToUUIDRange('abc123')).toEqual({
      min: 'abc12300-0000-0000-0000-000000000000',
      max: 'abc123ff-ffff-ffff-ffff-ffffffffffff',
    })
  })
})
