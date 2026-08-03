---
name: url-slug-vaga-publica
overview: Pagina publica de vaga individual com identificador legivel derivado, aplicando a skill url-slug.
todos: []
isProject: false
---

# URL Slug — pagina de vaga individual

## Problema

O 10xVagas nao tem nenhuma rota dinamica. Toda vaga so existe dentro do radar,
numa pagina unica. Nao ha como abrir, favoritar ou compartilhar uma vaga
especifica — o que e exatamente o que se espera de um radar de oportunidades.

## Solucao

Criar `/vaga/<identificador-publico>` e aplicar a skill `url-slug` para que esse
identificador seja legivel, estavel e resolvido com seguranca.

---

## Decisoes (protocolo da skill — fechar antes de codar)

### Decisão: Identidade pública

- **Contexto:** vagas vem de `engine/sources/output/live-jobs.json`, nao de
  tabela. A identidade interna e `RadarJob.id` — `BR-001`/`INT-007` para vagas do
  dataset de calibracao e `<source>:<external_id>` para vagas ao vivo. Nao ha
  onde persistir um slug.
- **Restrições medidas:** 31 vagas hoje; `external_id` unico (31/31), com 36
  chars (UUID) ou 7 (numerico). Sem banco de vagas, slug persistido e impossivel.
- **Alternativa escolhida:** nome decorativo + sufixo estavel **derivado** da
  identidade interna. Formato `<titulo-empresa>-<sufixo>`.
- **Alternativas rejeitadas:** slug persistido (nao ha tabela); id interno cru na
  URL (ilegivel e vaza a fonte); chave natural titulo+empresa (colide entre
  fontes que republicam a mesma vaga).
- **Consequências aceitas:** o sufixo muda se a identidade interna mudar; links
  antigos deixam de resolver. Aceitavel enquanto vaga nao for entidade
  persistida.
- **Gatilho de revisão:** quando vagas virarem tabela no Supabase, reavaliar para
  slug persistido com historico.

### Decisão: Formato e normalização

- **Gramática completa:** `^[a-z0-9]+(-[a-z0-9]+)*-[0-9a-f]{10}$`, ou somente
  `^[0-9a-f]{10}$` quando o decorativo normaliza para vazio.
- **Alfabeto:** `[a-z0-9-]`. **Separador:** `-`.
- **Normalização:** NFD, remove faixa `̀-ͯ` (escrita com escape, nunca
  combining mark literal), lowercase `en-US`, nao-alfanumerico vira `-`, colapsa
  repeticoes e apara as pontas.
- **Decorativo:** maximo 60 chars, cortado em fronteira de `-`.
- **Sufixo:** exatamente 10 chars hex de `sha256(id)`.
- **Rejeitar antes do lookup:** string vazia, sufixo ausente/incompleto/nao-hex,
  decorativo acima do limite, ausencia de `-` antes do sufixo.

### Decisão: Entropia e comprimento

- Espaco `N = 16^10 ≈ 1.1e12`. Com `n = 31` vagas, `P(colisão) ≈ 1 − e^(−n²/2N)`
  da ~4e-10. Mesmo com 100 mil vagas fica ~4.5e-3.
- O sufixo e hash de uma chave **ja unica**, entao colisao exige colisao de hash,
  nao de dominio.
- **Consequência aceita:** colisao continua possivel em teoria e por isso e
  **detectada**, nunca assumida como impossivel.

### Decisão: Ambiguidade

- **Escolhida:** buscar **todos** os candidatos com o mesmo sufixo. Resolver
  somente quando houver exatamente um. Com mais de um: log com o sufixo e os ids
  envolvidos, e resposta de nao encontrado.
- **Rejeitadas:** `limit(1)`/primeiro resultado (esconde o problema); ordenacao
  deterministica (estabiliza o resultado errado).

### Decisão: Compatibilidade

- **Greenfield:** nao existe formato legado. Nenhum link publicado.
- O id interno cru **nao** e aceito na URL publica — uma unica forma publica.
- Decorativo divergente (titulo renomeado na fonte) **resolve** e e
  **canonicalizado** via `replace` do roteador, preservando query e hash.

### Decisão: Resolução e autorização

- **Ponto único:** `resolveJobByPublicId` no Server Component da rota. Handlers e
  UI recebem a vaga ja resolvida, nunca o parametro da URL.
- A rota vive sob `(dashboard)`, entao o proxy exige sessao antes de qualquer
  resolucao. Identificador publico **nao** e credencial.
- Malformado, inexistente e ambiguo convergem para `notFound()` — indistinguiveis
  de fora.

### Decisão: Contrato entre backend e frontend

- `RadarJob` ganha `publicId`, materializado no unico produtor
  (`getExperimentDashboardData`), cobrindo vagas `matched` e `new`.
- Navegacao e compartilhamento usam `jobPath()`/`jobShareUrl()`. Nenhuma
  construcao inline.
- Identidade interna (`id`, `job_key`) segue nas APIs e na shortlist — a shortlist
  **nao** migra para slug.

---

## Checklist

- **Fase 1** — peca pura: `lib/urlSlug.ts` + testes
- **Fase 2** — helper de URL: `lib/resourceUrl.ts`
- **Fase 3** — contrato: `publicId` em `RadarJob` e no produtor
- **Fase 4** — resolver + rota `/vaga/[publicId]`
- **Fase 5** — navegacao a partir do radar
- **Fase 6** — smoke test

## Validação final

`typecheck` + `lint` nos dois workspaces, testes Jest pertinentes, e os cenarios:
forma canonica abre a vaga certa; decorativo divergente canonicaliza preservando
query/hash; malformado nao chega ao lookup; sufixo ambiguo nunca abre registro
arbitrario; UUID cru nao e confundido com sufixo valido.
