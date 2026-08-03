# 10xVagas

Radar inteligente de oportunidades profissionais. Descobre vagas, separa sinal de ruido, compara cada descricao com o Perfil Canonico e mantem a decisao final de candidatura com o usuario.

O produto segue o posicionamento de **copiloto de candidatura, nao bot de spam**.

## Estado atual

- Radar web com vagas nacionais e internacionais.
- Rotas independentes para Radar, Vagas salvas, Perfil Canonico e Fontes.
- Shortlist local-first por usuario, sincronizada pela API Node com o Supabase.
- Alcance da busca configuravel entre Brasil remoto, BH/RMBH hibrido e exterior remoto.
- Preferencia por remoto e por hibrido em Belo Horizonte/regiao metropolitana.
- Perfil Canonico bilingue extraido do portfolio e curriculo.
- Experimento de matching explicavel com 30 vagas de calibracao.
- Coleta publica com adaptadores Ashby, Greenhouse, Lever e Remotive.
- LinkedIn e Indeed em modo assistido, sem scraping ou automacao de login.
- Login Google com Supabase Auth, sessao SSR e dashboard protegido.
- Envio de candidatura permanece manual (`review`).

Ainda nao existem fila Postgres, Playwright ou worker de candidatura. A coleta publica gera um snapshot local e ainda precisa de agendamento. Esses componentes entram depois da validacao do ranking.

## Arquitetura

```text
10xvagas/
├── backend/      Express 5 + TypeScript — API de produto, auth e CRUD
├── frontend/     Next.js 16 + React 19 — radar e dashboard
├── engine/       Python — ferramentas de matching, parsing, Perfil Canonico e LLM
│   ├── experiment/   calibracao cega do ranking
│   └── sources/      contrato e adaptadores de descoberta
├── worker/       Node + Playwright — ATS e formularios (planejado; container dedicado)
└── package.json  npm workspaces para backend + frontend
```

Fronteiras planejadas:

- Node e o produto: autenticacao, API, configuracao e leitura do banco.
- Python e o motor de ferramentas: coleta, parsing, embeddings, matching e redacao.
- Node tambem executa o worker de browser: adaptadores deterministas em Playwright e Stagehand somente como fallback para formulario desconhecido.
- O frontend nunca chama LLM ou site de vaga diretamente.
- Engine e backend se comunicarao por fila em tabela Postgres, sem HTTP sincrono no pipeline.
- O clique final comeca humano (`review`); automacao de LinkedIn continua fora de escopo.

No experimento atual, o Server Component do Next le snapshots JSON locais. Isso e temporario e nao representa a arquitetura final de producao.

## Inicio rapido

Requisitos:

- Node.js 20.19 ou superior.
- npm.
- Python 3.11 ou superior.

```bash
npm install
npm run dev
```

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
npm run collect:jobs     # atualiza engine/sources/output/live-jobs.json
npm run profile:import -- --input curriculo.pdf --use-codex
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

O workflow Azure esta preparado em [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), mas os nomes de recursos continuam como placeholders deliberados. O preflight bloqueia deploy ate ACR, Resource Group, Web Apps e URL publica do backend serem provisionados para o 10xVagas.

O engine ainda nao possui container de ferramentas e, portanto, nao entra no workflow atual.
