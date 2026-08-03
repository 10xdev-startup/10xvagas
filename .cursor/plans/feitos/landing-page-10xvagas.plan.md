---
name: Landing page publica do 10xVagas
overview: Cria uma LP publica inspirada na cadencia da 10xDev, com narrativa e demonstracoes proprias do 10xVagas, e move o radar autenticado para /dashboard.
todos: []
isProject: false
---

# Landing page publica do 10xVagas

## Problema

A rota raiz abre direto no produto autenticado. O 10xVagas ainda nao explica sua proposta antes do login nem separa aquisicao do workspace.

## Solucao

Usar o padrao da LP principal da 10xDev — header fixo, promessa direta, demonstracao visual do produto, blocos alternados e CTA final — com identidade e copy proprias. A raiz `/` fica publica e o radar passa para `/dashboard`.

## Reaproveitamento

- `10xdev/frontend/components/PublicHome.tsx`: estrutura de header, navegacao por ancoras e footer.
- `10xdev/frontend/components/LandingPage.tsx`: cadencia hero → demonstracoes → CTA.
- `frontend/components/TenXVagasLogo.tsx`: marca existente.
- `frontend/components/showcase/blocks/ThemeToggle.tsx`: alternancia de tema existente.
- `frontend/app/(dashboard)/page.tsx`: radar existente, apenas muda de rota.
- `frontend/lib/authRedirect.ts` e `frontend/proxy.ts`: redirect seguro e fronteira publica/privada existentes.

## Checklist resumida

```text
Fase 0: Separar raiz publica do dashboard autenticado
Fase 1: Construir LP responsiva com demonstracoes do produto
Fase 2: Ajustar navegacao, auth e metadados
Fase final: Validar tipos, lint, testes, build e rotas
```

## Passo a passo

### Fase 0 — Fronteira publica

**Objetivo:** `/` abre sem sessao e `/dashboard` preserva o radar atual.

1. Em `frontend/app/(dashboard)/dashboard/page.tsx`, mover a pagina atual do radar.
2. Em `frontend/proxy.ts`, tornar apenas a raiz publica e manter as rotas do produto protegidas.
3. Em navegacao e redirects, trocar o destino principal autenticado para `/dashboard`.

**Validacao parcial:** usuario anonimo acessa `/`; `/dashboard` redireciona para `/login?redirect=/dashboard`.

**Commit sugerido:** `refactor(rotas): separa landing publica do dashboard`

### Fase 1 — Experiencia da landing page

**Objetivo:** apresentar o produto com a mesma qualidade visual do dashboard, sem imagens genericas nem cores hardcoded.

1. Em `frontend/components/MarketingLandingPage.tsx`, criar header, hero, mockup do radar, fluxo, diferenciais, controle de automacao, CTA e footer.
2. Em `frontend/app/page.tsx`, renderizar a LP publica e definir metadados da pagina.
3. Reusar apenas tokens semanticos (`brand`, `signal`, `match-*`, `border`, `card`) e o logo existente.

**Validacao parcial:** LP legivel e funcional em mobile e desktop, com links de ancoras e CTAs para login.

**Commit sugerido:** `feat(lp): apresenta proposta do 10xvagas`

### Fase 2 — Coerencia de produto

**Objetivo:** todos os caminhos de entrada levam ao radar autenticado correto.

1. Atualizar `AppSidebar`, `DashboardHeader`, login e callback para `/dashboard`.
2. Atualizar testes de redirect e navegacao afetados.

**Validacao parcial:** login direto, login iniciado pela LP e navegacao da sidebar terminam em `/dashboard`.

**Commit sugerido:** `fix(auth): direciona entradas para o dashboard`

### Fase final — Validacao (smoke test)

- `npm run typecheck -w frontend` → 0 erros.
- `npm run lint -w frontend` → 0 erros.
- Testes Jest pertinentes de redirect e radar → passam.
- `npm run build -w frontend` → build de producao concluido.
- `/` responde com a LP sem sessao.
- `/dashboard` preserva o radar e exige autenticacao.
- Mobile: header, mockup e CTAs nao geram overflow horizontal.

## Diagrama: estado atual vs. desejado

### Atual

```text
/                              (existente — protegido)
└── dashboard + sidebar

/login                         (existente — publico)
```

### Desejado

```text
/                              ✨ NOVO — landing publica
├── proposta e demonstracao
└── CTA → /login?redirect=/dashboard

/dashboard                     (existente — muda de rota)
└── radar + sidebar             ◄── protegido pelo proxy

/login                         (existente)
└── sucesso → /dashboard
```
