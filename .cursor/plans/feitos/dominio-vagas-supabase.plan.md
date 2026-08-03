---
name: dominio-vagas-supabase
overview: Mover vagas e matches dos snapshots do engine para Supabase, expor o dominio no Express e deixar o frontend dependente apenas da API.
todos:
  - id: schema
    content: Aplicar tabelas job e job_match com RLS no Supabase
    status: completed
  - id: backend
    content: Implementar dominio de vaga, slug publico e resolucao na borda
    status: completed
  - id: engine
    content: Persistir coleta e matching pela REST API do Supabase
    status: completed
  - id: frontend
    content: Trocar snapshots locais pelo jobService e URLs fornecidas pelo backend
    status: completed
  - id: validation
    content: Executar testes filtrados, lint, typecheck e smoke tests
    status: completed
isProject: false
---

# `Dominio de vagas no backend e Supabase`

---

## Problema

O frontend monta vagas e matches lendo tres snapshots JSON do engine. Isso congela dados na
imagem Docker, impede isolamento de matches por usuario e deixa a identidade publica da vaga
sob responsabilidade do Next.js.

---

## Solucao

Persistir vagas globais em `job` e matches privados em `job_match`; criar o dominio
Controller → Model → Routes no Express; resolver UUID/slug em `router.param`; fazer o engine
usar a REST API do Supabase com biblioteca padrao; e consumir o contrato `RadarJob` pelo
`apiClient` no frontend.

---

## Decisoes de URL publica

### Decisao

- **Contexto:** o identificador publico atual do PR #1 usa dez caracteres de SHA-256 sobre
  uma identidade que ainda nao era uma PK de banco. Este trabalho cria `job.id uuid`.
- **Restricoes medidas:** hoje existem 31 vagas; o slug precisa ser legivel, opaco o
  bastante para compartilhamento, resolvido por indice e seguro diante de colisao.
- **Alternativa escolhida:** formato `<titulo-empresa>-<prefixo>`, com os primeiros 6 hex
  da PK UUID. A parte textual e decorativa. O lookup usa intervalo UUID nativo e busca no
  maximo dois candidatos.
- **Alternativas rejeitadas:**
  - hash SHA-256 de 10 hex: evita consulta para gerar, mas exige expressao/campo auxiliar
    para lookup eficiente e preserva um padrao criado apenas porque nao havia PK UUID;
  - UUID completo: robusto, mas ruim para leitura e compartilhamento;
  - slug textual unico: renomeia quando titulo/empresa mudam e introduz corrida de unicidade.
- **Consequencias aceitas:** o espaco de 24 bits pode colidir conforme a base cresce; uma
  colisao devolve 404 e gera log com os IDs, sem selecionar qualquer candidato.
- **Compatibilidade necessaria:** UUID completo continua aceito como identidade canonica
  antes do parser. Os slugs hash estavam apenas no PR #1, ainda fora da `main`, portanto nao
  ha URL de producao a preservar. O parser de slug rejeita UUID cru, inclusive seu grupo
  final de 12 hex; essa entrada so passa pelo guard canonico.
- **Validacao:** testes unitarios cobrem acentos, formato, fronteira, UUID canonico,
  inexistencia e dois candidatos. Teste de rota confirma que o controller recebe UUID.
- **Gatilho de revisao:** aumentar o prefixo para 8 caracteres ao atingir 10 mil vagas ou
  na primeira ambiguidade observada, o que ocorrer antes; uma mudanca exige compatibilidade
  temporaria com o comprimento anterior.

### Inventario de superficies

- API interna: `GET /jobs` e `GET /jobs/:id`.
- URL de navegacao/compartilhamento: `/vaga/:publicId`.
- Identidade canonica interna: UUID em API, filtros, `job_match` e shortlist.
- Identidade externa natural: `(source, external_id)` apenas para upsert do coletor.
- Helper frontend permitido: `jobPath(publicId)` apenas concatena a URL entregue pelo
  backend; nao gera nem interpreta slug.
- Canonicalizacao: apos resolver uma URL decorativa antiga para a mesma PK, a pagina usa o
  `publicId` atual devolvido pela API para `replaceState` e `link rel=canonical`.

---

## Modelagem e seguranca

### `job` — catalogo global compartilhado

- PK `id uuid default gen_random_uuid()`.
- Chave natural `unique (source, external_id)`.
- Dados normalizados da fonte, `first_seen_at`, `last_seen_at`, `created_at`, `updated_at`.
- RLS habilitada; leitura para `authenticated`; nenhuma mutacao para clientes. O engine e o
  backend usam service-role.

### `job_match` — julgamento privado por usuario

- PK composta `(user_id, job_id)`; FKs para `auth.users` e `job`.
- `score`, `rank`, `excluded`, `reasons`, `gaps`, `skills`, timestamps.
- RLS habilitada com policies de SELECT/INSERT/UPDATE/DELETE por `auth.uid() = user_id`.
- Toda consulta no backend inclui `user_id`, mesmo com service-role.

O DDL foi aplicado no SQL Editor do Supabase em 03/08/2026 porque os tokens de Management
locais devolveram 403 para este projeto. Nenhum arquivo `.sql` foi adicionado ao repositorio.

---

## Checklist resumida

```text
Fase 0: registrar decisoes, inventario e contratos
Fase 1: aplicar schema seguro no Supabase
Fase 2: criar dominio Job no Express e testes de slug/resolucao
Fase 3: trocar snapshots do coletor por upsert REST e persistir matches quando configurado
Fase 4: consumir a API no radar, fontes e detalhe publico
Fase 5: remover leituras JSON e copia do engine da imagem frontend
Fase final: validar escopos filtrados, lint, typecheck e smoke tests
```

---

## Passo a passo

### Fase 1 — Banco

**Objetivo:** criar as fontes persistentes sem expor matches de um usuario a outro.

1. Aplicar DDL idempotente pela Management API.
2. Verificar tabelas, constraints, indices, RLS e policies por consulta de metadados.
3. Importar a coleta atual pelo engine depois de o writer REST estar pronto.

**Validacao parcial:** REST autenticada lista `job`; usuario A nao le `job_match` de B.

### Fase 2 — Backend

**Objetivo:** o Express ser o unico dono da vaga e de sua identidade publica.

1. Criar `types/job.ts`, `JobModel.ts`, `JobController.ts`, `jobRoutes.ts`,
   `jobRouteParams.ts` e `utils/slugify.ts`.
2. `JobModel.resolveId` consulta intervalo UUID com `limit(2)`.
3. `router.param('id', resolveJobIdParam)` substitui o parametro antes do controller.
4. Montar `/jobs` depois do `supabaseMiddleware`; `user_id` vem apenas de `req.user`.
5. Atualizar health/readiness para incluir as novas tabelas.

**Validacao parcial:** testes filtrados de slug, model, route params e controller.

### Fase 3 — Engine

**Objetivo:** coleta recorrente atualizar o catalogo sem dependencia Python externa.

1. Criar cliente REST pequeno com `urllib.request`, timeout e erros acionaveis.
2. `collect.py` faz upsert por `(source, external_id)` e atualiza `last_seen_at`.
3. O experimento persiste `job_match` quando `MATCH_USER_ID` estiver configurado, mantendo
   seus artefatos offline apenas como ferramenta de calibracao, nunca como fonte da UI.
4. Testar payload e falhas com HTTP mockado.

**Validacao parcial:** testes unitarios do writer e `compileall` do engine.

### Fase 4 — Frontend

**Objetivo:** radar, fontes e detalhe dependerem do contrato da API.

1. Criar `services/jobService.ts` sobre `apiClient`.
2. Criar workspaces client para estados loading/error/success de dashboard e fontes.
3. Adicionar `/vaga/[publicId]`, detalhe e canonicalizacao usando o `publicId` da API.
4. Adicionar `publicId` ao snapshot de vagas salvas.
5. Remover `lib/experiment.ts`, rota CSV de experimento e imports relacionados.
6. Remover `COPY engine` do Dockerfile quando o Perfil Canonico deixar de depender do
   arquivo local; incorporar a transicao ja revisada no PR #2 ou tornar esta entrega
   explicitamente dependente dele antes do PR final.

**Validacao parcial:** testes filtrados de service, radar e pagina de detalhe; busca por
`node:fs`, `live-jobs.json`, `jobs.json` e `system-ranking.json` no frontend retorna zero.

### Fase final — Validacao

- `npm run typecheck -w backend` e `npm run lint -w backend`.
- `npm run typecheck -w frontend` e `npm run lint -w frontend`.
- Apenas Jest pertinente por arquivo; nunca a suite inteira.
- Testes Python de `engine/sources` e arquivos relacionados ao writer.
- Smoke test autenticado em `GET /jobs` e `GET /jobs/:slug`.
- Confirmar 404 para slug invalido, inexistente e ambiguo; o ultimo precisa registrar IDs.
- Confirmar envelope `{ success: true, data }` / `{ success: false, error }`.
- Confirmar que nenhum payload aceita `user_id`.

---

## Diagrama: estado atual vs. desejado

### Atual

```text
engine JSONs no repositorio e imagem
        │
        ▼
frontend/lib/experiment.ts             (le arquivo no Server Component)
        ├── radar / dashboard
        └── resolucao publica no Next
```

### Desejado

```text
Fontes publicas
      │
      ▼
engine/sources/collect.py              (urllib + service-role)
      │ upsert (source, external_id)
      ▼
Supabase
      ├── job                          (global, RLS, leitura autenticada)
      └── job_match                    (privado por user_id, RLS por dono)
              │
              ▼
backend/src/models/JobModel.ts         (unico acesso ao banco)
              │
              ▼
backend/src/routes/jobRoutes.ts
      ├── GET /jobs
      └── GET /jobs/:id
               │
               └── router.param resolve UUID ou slug; ambiguidade → log + 404
              │
              ▼
frontend/services/jobService.ts        (apiClient desembrulha uma vez)
      ├── /dashboard
      ├── /sources
      └── /vaga/:publicId
```

---

## Criterio de conclusao da skill `url-slug`

- [x] Resolucao inequivoca e colisao tratada sem `limit(1)`.
- [x] Identidade canonica aceita antes do parser.
- [x] Slug validado integralmente antes da consulta.
- [x] Inexistencia, malformacao e ambiguidade com semantica 404 consistente.
- [x] Geracao e resolucao pertencem ao backend.
- [x] Navegacao, compartilhamento e canonicalizacao usam o contrato publico.
- [x] Testes cobrem pureza, borda, persistencia, rota, colisao e compatibilidade.
