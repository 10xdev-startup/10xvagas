# Frontend do 10xVagas

Aplicacao Next.js 16 + React 19 do radar de oportunidades.

## Comandos

```bash
npm run dev
npm run typecheck
npm run lint
npm test -- tests/JobRadar.test.tsx --runInBand
```

## Organizacao

- `app/page.tsx`: landing page publica.
- `app/(dashboard)/dashboard`: radar autenticado; as demais rotas do grupo compartilham sidebar e header.
- `app/login` e `app/auth/callback`: entrada Google OAuth e callback PKCE.
- `components/`: componentes de produto, incluindo `MarketingLandingPage`.
- `components/ui/`: primitives shadcn/Radix.
- `components/showcase/blocks/`: biblioteca interna herdada do template; nao e uma rota publica.
- `lib/supabase/`: clientes oficiais de browser e servidor; `proxy.ts` renova cookies e protege o dashboard.
- `hooks/useAuth.tsx`: estado da sessao e acoes de login/logout.
- `lib/`: leitura server-side e utilitarios.
- `services/`: transporte HTTP via `apiClient`.
- `tests/`: testes Jest + Testing Library.

Vagas e matches sao consumidos do backend por `services/jobService.ts`. O frontend nao le
artefatos do engine nem leva o diretorio `engine/` em sua imagem Docker.

## Login local

Use `frontend/.env.example` como referencia. A API Express deve usar o mesmo projeto Supabase para conseguir validar o JWT enviado pelo `apiClient`.

### Google OAuth

O projeto hospedado usado no desenvolvimento e `bqlkonzhvmjccpizimnz`. Configure o login em duas etapas:

1. No Google Auth Platform, crie um cliente OAuth do tipo **Aplicativo da Web**.
   - Origens JavaScript: `http://localhost:3000` e a origem publica do frontend.
   - URI de redirecionamento: `https://bqlkonzhvmjccpizimnz.supabase.co/auth/v1/callback`.
2. No Supabase, abra **Authentication > Sign In / Providers > Google**, habilite o provider e salve o Client ID e o Client Secret gerados pelo Google.
3. Em **Authentication > URL Configuration**, configure:
   - Site URL de producao: a origem publica do frontend.
   - Redirect URLs: `http://localhost:3000/auth/callback` e `<origem-publica>/auth/callback`.

O callback cadastrado no Google pertence ao Supabase. O callback `/auth/callback` pertence ao frontend e deve ser cadastrado somente na allowlist de redirects do Supabase.
