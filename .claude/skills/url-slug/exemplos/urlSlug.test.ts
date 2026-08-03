import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { makeSlug, parseSlugPrefix, prefixToUuidRange, type UrlSlugPolicy } from './urlSlug'
import { resolvePublicId } from './resolvePublicId'
import { resourcePath, resourceShareUrl } from './resourceUrl'

// Política ilustrativa. Substituir pelos valores decididos e registrados no plano do projeto.
const EXAMPLE_POLICY: UrlSlugPolicy = {
  generatedPrefixLength: 12,
  acceptedPrefixLengths: [12, 6],
}

const ID = '6f2a9c7e-3b41-4d0a-9e12-8ab7c5d10f33'

test('faz round-trip da forma gerada', () => {
  const slug = makeSlug('Nome do recurso', ID, EXAMPLE_POLICY)
  assert.equal(slug, 'nome-do-recurso-6f2a9c7e3b41')
  assert.deepEqual(parseSlugPrefix(slug, EXAMPLE_POLICY), {
    value: '6f2a9c7e3b41',
    length: 12,
    name: 'nome-do-recurso',
  })
})

test('aceita formato legado sem confundir fronteiras', () => {
  assert.equal(parseSlugPrefix('nome-do-recurso-6f2a9c', EXAMPLE_POLICY)?.length, 6)
  assert.equal(parseSlugPrefix('nome-zzz2c3d4e5f6', EXAMPLE_POLICY), null)
})

test('converte prefixo validado em range de UUID', () => {
  assert.deepEqual(prefixToUuidRange('6f2a9c'), {
    min: '6f2a9c00-0000-0000-0000-000000000000',
    max: '6f2a9cff-ffff-ffff-ffff-ffffffffffff',
  })
})

test('resolve somente candidato inequívoco', async () => {
  const resolved = await resolvePublicId('nome-do-recurso-6f2a9c7e3b41', EXAMPLE_POLICY, {
    lookupCandidates: async () => [{ id: ID }],
  })
  assert.equal(resolved, ID)

  const ambiguous = await resolvePublicId('nome-do-recurso-6f2a9c7e3b41', EXAMPLE_POLICY, {
    lookupCandidates: async () => [{ id: ID }, { id: '6f2a9c7e-3b41-4d0a-9e12-8ab7c5d10f34' }],
  })
  assert.equal(ambiguous, null)
})

test('centraliza navegação e compartilhamento', () => {
  const resource = { id: ID, slug: 'nome-do-recurso-6f2a9c7e3b41' }
  assert.equal(resourcePath('resources', resource, 'details', 'tab=history'), '/resources/nome-do-recurso-6f2a9c7e3b41/details?tab=history')
  assert.equal(resourceShareUrl('https://example.com/', 'resources', resource), 'https://example.com/resources/nome-do-recurso-6f2a9c7e3b41')
})
