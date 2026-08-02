---
name: Autenticacao Supabase do 10xVagas
overview: Reaproveitar o fluxo de Google OAuth e o nucleo do schema de usuarios da 10xDev, em um Supabase separado, atualizando o frontend para SSR e Proxy do Next.js 16.
todos: []
isProject: false
---

# `Autenticacao Supabase do 10xVagas`

---

## Problema

O backend ja valida JWT do Supabase e mantem o perfil em `users`, mas o frontend nao oferece login, callback OAuth, sessao SSR, protecao do dashboard nem logout.

---

## Solucao

Adaptar a autenticacao Google da 10xDev ao 10xVagas usando `@supabase/ssr`, cookies PKCE e `proxy.ts` do Next.js 16. Manter a autorizacao sensivel no backend por Bearer token e adicionar somente o fluxo de Google OAuth definido para o MVP.

---

## Checklist resumida

```
Fase 0: confirmar contratos existentes e APIs atuais do Next/Supabase
Fase 1: criar clientes Supabase SSR e Proxy de sessao
Fase 2: implementar provider, login, callback e logout
Fase 3: integrar identidade do usuario na sidebar
Fase 4: aplicar users + RLS + triggers no Supabase separado
Fase final: validar tipos, lint, testes e redirects
```

---

## Passo a passo

### Fase 1 — Sessao SSR

**Objetivo:** compartilhar a sessao Supabase entre browser, Route Handlers e Proxy.

1. Em `frontend/lib/supabase/`, criar clientes de browser, servidor e atualizacao de sessao.
2. Em `frontend/proxy.ts`, atualizar tokens e redirecionar visitantes anonimos para `/login`.
3. Manter `/login` e `/auth/callback` publicos e preservar apenas redirects internos seguros.

**Validacao parcial:** proxy compila e a rota privada sem cookie redireciona para `/login?redirect=/`.

**Commit sugerido:** `feat(auth): configura sessao supabase no next`

---

### Fase 2 — Login e callback

**Objetivo:** permitir login Google e estabelecer a sessao PKCE.

1. Em `frontend/app/login/page.tsx`, criar a tela com identidade 10xVagas e estados de erro/carregamento.
2. Em `frontend/app/auth/callback/route.ts`, trocar o code OAuth pela sessao e voltar ao destino seguro.
3. Em `frontend/hooks/useAuth.tsx`, expor usuario, carregamento, login Google e logout.
4. Em `frontend/app/layout.tsx`, montar o provider global.

**Validacao parcial:** testes cobrem destino seguro, estado anonimo e disparo do OAuth.

**Commit sugerido:** `feat(auth): adiciona login google do 10xvagas`

---

### Fase 3 — Conta na navegacao

**Objetivo:** tornar a sessao visivel e controlavel sem sair do dashboard.

1. Em `frontend/components/AppSidebar.tsx`, mostrar nome/email/avatar do usuario.
2. Adicionar acao de sair que encerra a sessao e retorna para `/login`.

**Validacao parcial:** usuario autenticado aparece na sidebar e logout limpa a sessao.

**Commit sugerido:** `feat(auth): integra conta a sidebar`

---

### Fase 4 — Espelho estrutural de usuarios

**Objetivo:** criar no Supabase do 10xVagas o nucleo seguro de identidade validado na 10xDev, sem copiar dados pessoais nem campos de outros dominios.

1. Via Supabase Management API, criar `public.users` com FK para `auth.users`.
2. Habilitar RLS e policies de leitura/edicao do proprio perfil.
3. Criar `handle_new_user` em `auth.users`, trigger de `updated_at` e guarda de `role/status`.
4. Manter o upsert do middleware Node como fallback idempotente.

**Validacao parcial:** login Google cria uma linha em `public.users`; outro usuario nao consegue le-la nem alterar `role/status` pelo client anon/authenticated.

**Bloqueio externo:** o token atual lista apenas 10xDev e 10xConsorcios. E necessario criar/fornecer o projeto Supabase separado do 10xVagas antes de aplicar o DDL.

**Commit sugerido:** `feat(auth): espelha nucleo de usuarios no supabase`

---

### Fase final — Validacao (smoke test)

- `npm run typecheck -w backend` → 0 erros.
- `npm run lint -w backend` → 0 erros.
- `npm run typecheck -w frontend` → 0 erros.
- `npm run lint -w frontend` → 0 erros.
- Testes Jest pertinentes do frontend.
- `GET /` anonimo → redirect para `/login?redirect=%2F`.
- `GET /login` → tela 10xVagas sem layout do dashboard.
- Callback rejeita redirect externo e volta para `/`.
- Com credenciais reais: login Google cria cookie, abre dashboard e `GET /users/me` aceita o Bearer token.

---

## Diagrama: estado atual vs. desejado

### Atual

```text
Browser → dashboard publico
   └── apiClient → Bearer opcional → backend com JWT obrigatorio
```

### Desejado

```text
/login                                      ✨ NOVO
   │ signInWithOAuth(provider: google)
   ▼
Supabase Auth                               (existente)
   │ code PKCE
   ├──► trigger auth.users → public.users  ✨ NOVO no projeto 10xVagas
   ▼
/auth/callback                              ✨ NOVO
   │ troca code por cookies de sessao
   ▼
frontend/proxy.ts                           ✨ NOVO
   ├─ atualiza token via getClaims
   └─ anonimo em rota privada → /login
   │
   ▼
Dashboard + AuthProvider                    (existente — ganha sessao)
   ├─ sidebar mostra conta e logout
   └─ apiClient envia Bearer JWT
          │
          ▼
backend supabaseMiddleware                  (existente)
   └─ valida JWT + garante public.users
```
