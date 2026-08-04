# 10xVagas

Radar inteligente de oportunidades profissionais. Descobre vagas, separa sinal de ruido, compara cada descricao com o Perfil Canonico e mantem a decisao final de candidatura com o usuario.

O produto segue o posicionamento de **copiloto de candidatura, nao bot de spam**.

## Estado atual

- Radar web com vagas nacionais e internacionais.
- Landing page publica na raiz e workspace autenticado em `/dashboard`.
- Rotas independentes para Radar, Vagas salvas, Perfil Canonico e Fontes.
- Shortlist local-first por usuario, sincronizada pela API Node com o Supabase.
- Alcance da busca configuravel entre Brasil remoto, BH/RMBH hibrido e exterior remoto.
- Preferencia por remoto e por hibrido em Belo Horizonte/regiao metropolitana.
- Perfil Canonico bilingue extraido do portfolio e curriculo.
- Experimento de matching explicavel com 30 vagas de calibracao.
- Coleta publica com adaptadores Ashby, Greenhouse, Lever e Remotive.
- LinkedIn e Indeed em modo assistido, sem scraping ou automacao de login.
- Login Google com Supabase Auth, sessao SSR e dashboard protegido.
- Upload privado de PDF, DOCX e TXT com analise assincrona do curriculo.
- Rascunho de Perfil Canonico com diagnostico, evidencias, perguntas e aprovacao humana.
- Billing por tokens com meters `10xvagas_*`, rate card isolado e debito idempotente.
- Envio de candidatura permanece manual (`review`).

Ainda nao existe worker Playwright de candidatura. A analise de perfil ja usa fila Postgres
com lease/heartbeat; a automacao de formularios entra em uma fase posterior.

## Arquitetura

```text
10xvagas/
├── backend/      Express 5 + TypeScript — API de produto, auth e CRUD
├── frontend/     Next.js 16 + React 19 — radar e dashboard
├── engine/       Python — matching, parsing e worker de analise do Perfil Canonico
│   ├── experiment/   calibracao cega do ranking
│   └── sources/      contrato e adaptadores de descoberta
├── worker/       Node + Playwright — ATS e formularios (planejado; container dedicado)
└── package.json  npm workspaces para backend + frontend
```

Fronteiras:

- Node e o produto: autenticacao, API, configuracao e leitura do banco.
- Python e o motor de ferramentas: coleta, parsing, embeddings, matching e redacao.
- Node tambem executa o worker de browser: adaptadores deterministas em Playwright e Stagehand somente como fallback para formulario desconhecido.
- O frontend nunca chama LLM ou site de vaga diretamente.
- Engine e backend se comunicam por fila em tabela Postgres, sem HTTP sincrono no pipeline.
- O clique final comeca humano (`review`); automacao de LinkedIn continua fora de escopo.

Vagas e matches vivem no Supabase e sao entregues ao frontend pela API Node.

## Inicio rapido

Requisitos:

- Node.js 20.19 ou superior.
- npm.
- Python 3.11 ou superior.

```bash
npm install
npm run dev
```

Para incluir o worker de analise na mesma sessao local, use `npm run dev:analysis`.
Ele preserva frontend em `3000` e backend em `3001`; o worker apenas consome a fila.

Antes do primeiro login, copie as variaveis de `frontend/.env.example` e `backend/.env.example` para os respectivos arquivos locais e informe as chaves do mesmo projeto Supabase. No painel do Supabase:

1. habilite o provider Google em **Authentication → Providers**;
2. adicione `http://localhost:3000/auth/callback` nas URLs de redirecionamento;
3. crie `public.users` conforme o DDL documentado em [`.claude/CLAUDE.md`](.claude/CLAUDE.md).

O cadastro e aberto: qualquer conta autenticada pelo Supabase Auth entra e recebe o proprio espaco, isolado por `user_id` e RLS. No backend, configure `CORS_ORIGINS` com as origens permitidas.

O Supabase do 10xVagas deve ser um projeto separado. O schema de `users` reaproveita
FK, RLS, policies e trigger de criacao da 10xDev, mas nao copia dados nem colunas
especificas de GitHub, Stripe, creditos ou comunidade.

Servicos locais:

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/health
- Readiness do banco: http://localhost:3001/ready

## Comandos

```bash
npm run dev              # backend + frontend
npm run build            # build dos workspaces Node
npm run typecheck        # TypeScript dos dois lados
npm run lint             # ESLint dos dois lados
npm run test:backend     # testes Jest do backend
npm run test:frontend    # testes Jest do frontend
npm run test:engine      # testes Python de matching e fontes
npm run collect:jobs     # faz upsert das vagas no Supabase
npm run engine:cycle     # coleta, registra fontes e recalcula matches
npm run match:jobs       # recalcula somente os matches persistidos
npm run profile:import -- --input curriculo.pdf --use-codex
npm run profile:sync     # associa o perfil revisado ao PROFILE_USER_ID
npm run profile:worker   # processa continuamente a fila de analises
npm run dev:analysis     # frontend + backend + worker de analise
```

As suites Jest devem ser executadas com arquivo/filtro durante desenvolvimento para nao sobrecarregar o WSL. Consulte [`.claude/CLAUDE.md`](.claude/CLAUDE.md).

## Fontes de vagas

Toda fonte automatica implementa o mesmo contrato `SourceAdapter` e produz `SourceJob` normalizado.

| Fonte | Modo | Descricao |
|---|---|---|
| Ashby | automatico | API publica de job board |
| Greenhouse | automatico | Job Board API publica |
| Lever | automatico | Postings API publica |
| Remotive | automatico | feed publico de vagas remotas |
| LinkedIn | assistido | busca humana/link; sem scraping |
| Indeed | assistido | busca humana/link; sem API publica de candidato |

Registro das fontes: [`engine/sources/registry.json`](engine/sources/registry.json).

## Matching

O baseline separa rigorosamente:

- `skills_known`: tecnologias conhecidas, incluindo historico de suporte.
- `skills_desired`: tecnologias que podem elevar o score.

Office 365, AnyDesk, helpdesk, redes e suporte nunca geram pontuacao positiva. Pesos, aliases, penalidades e filtros ficam em [`engine/experiment/config/matching-weights.json`](engine/experiment/config/matching-weights.json).

Protocolo completo: [`engine/experiment/README.md`](engine/experiment/README.md).

## Convencoes 10xDev

- Backend: Controller → Model → Routes.
- API: envelope `{ success: true, data }` / `{ success: false, error }`.
- Frontend: `apiClient` desembrulha o envelope uma vez.
- Componentes PascalCase, utilitarios camelCase, banco snake_case, API kebab-case.
- DDL via Supabase Management API; sem migrations SQL no repositorio.
- Sessao web via `@supabase/ssr`; autorizacao da API sempre pelo Bearer JWT validado no backend.
- Cadastro aberto; isolamento por usuario garantido por `user_id` e RLS, nao por allowlist.
- Conversa, commits e PRs em portugues; codigo-fonte em ingles.
- Dark mode por tokens sem cores hardcoded nos componentes de produto.

## Deploy

O workflow Azure em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publica
frontend, backend e o engine. O worker usa a imagem de [`engine/Dockerfile`](engine/Dockerfile)
com `poppler-utils`, usuario nao-root e health check HTTP no Web App dedicado
`web-engine-10xvagas`.

Variaveis adicionais desta feature:

- backend: `STRIPE_RATE_CARD_ID`, `PROFILE_ANALYSIS_MODEL_ID` e
  `AI_USAGE_SETTLEMENT_ENABLED`;
- engine: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` e
  `STRIPE_LLM_GATEWAY_URL`.

`STRIPE_CHECKOUT_ENABLED` e `AI_USAGE_SETTLEMENT_ENABLED` foram liberadas depois do smoke
live de usage, rate card, meter events, debito e retry idempotente. Em ambiente novo,
comece com ambas em `false` e so as habilite depois de repetir essa validacao.
