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

- `app/`: rotas e layouts.
- `app/login` e `app/auth/callback`: entrada Google OAuth e callback PKCE.
- `components/`: componentes de produto.
- `components/ui/`: primitives shadcn/Radix.
- `components/showcase/blocks/`: biblioteca interna herdada do template; nao e uma rota publica.
- `lib/supabase/`: clientes oficiais de browser e servidor; `proxy.ts` renova cookies e protege o dashboard.
- `hooks/useAuth.tsx`: estado da sessao e acoes de login/logout.
- `lib/`: leitura server-side e utilitarios.
- `services/`: transporte HTTP via `apiClient`.
- `tests/`: testes Jest + Testing Library.

Durante o experimento, `lib/experiment.ts` le snapshots do engine no monorepo. Em producao, esse acesso deve migrar para backend/banco.

## Login local

Use `frontend/.env.example` como referencia, habilite Google no Supabase e cadastre `http://localhost:3000/auth/callback` como redirect permitido. A API Express deve usar o mesmo projeto Supabase para conseguir validar o JWT enviado pelo `apiClient`.
