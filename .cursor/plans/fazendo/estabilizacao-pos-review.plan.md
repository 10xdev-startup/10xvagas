---
name: Estabilizacao pos-review do 10xVagas
overview: Fechar acesso single-user, impedir serializacao de PII, conectar vagas salvas ao backend e tornar o build Docker coerente com o monorepo.
todos: []
isProject: false
---

# Estabilizacao pos-review do 10xVagas

## Problema

O dashboard ainda serializa o Perfil Canonico completo, aceita qualquer conta autenticada, mantem vagas salvas apenas no navegador e usa um build Docker que nao recebe os arquivos do engine consumidos pelo Next.

## Solucao

Aplicar allowlist server-side no frontend e backend, projetar um DTO publico do perfil, sincronizar a shortlist pela API Node mantendo resposta local imediata e construir ambos os containers a partir da raiz do monorepo com lockfile e `.dockerignore`.

## Checklist

```
Fase 1: acesso single-user e DTO sem PII
Fase 2: sincronizacao de saved_job
Fase 3: Docker/CI reproduzivel
Fase 4: readiness e seguranca basica
Fase final: tipos, lint, testes, build e smoke test
```

## Validacao

- Conta fora da allowlist nao entra no dashboard nem na API.
- O artefato `/profile` nao contem e-mail ou telefone do perfil.
- Salvar/remover chama `/saved-jobs` e preserva resposta otimista local.
- O frontend Docker recebe `engine/` no contexto.
- Health de prontidao detecta ausencia de `public.users`.
