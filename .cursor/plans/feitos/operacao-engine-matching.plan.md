---
name: operacao-engine-matching
overview: Automatizar coleta e matching sobre o Supabase, persistir saude das fontes e restaurar a skill url-slug.
todos:
  - id: source-run-schema
    content: Criar source_run com RLS e leitura autenticada
    status: completed
  - id: live-matching
    content: Normalizar vagas vivas e calcular job_match para cada perfil
    status: completed
  - id: profile-sync
    content: Sincronizar o Perfil Canonico somente com usuario explicitamente informado
    status: completed
  - id: engine-cycle
    content: Orquestrar coleta, saude e matching em um ciclo idempotente
    status: completed
  - id: schedule
    content: Agendar o ciclo em GitHub Actions a cada seis horas
    status: completed
  - id: backend-source-health
    content: Expor status real das fontes pelo dominio Job
    status: completed
  - id: restore-skill
    content: Restaurar a skill url-slug sem recuperar a implementacao antiga
    status: completed
  - id: validation
    content: Validar localmente, executar ciclo real e abrir PR
    status: completed
isProject: false
---

# `Operacao automatica do engine e matching vivo`

## Problema

O catalogo possui 30 vagas, mas somente duas casaram por URL com o dataset antigo e receberam
`job_match`. A coleta foi executada manualmente e a API sintetiza a saude das fontes a partir
das vagas, sem saber quando um adaptador falhou. A skill `url-slug` tambem ficou apenas no PR
fechado #1.

## Solucao

Criar um normalizador deterministico para o contrato do matcher, processar todas as vagas para
cada Perfil Canonico armazenado, persistir cada execucao de fonte em `source_run`, executar o
ciclo completo por cron no GitHub Actions e restaurar somente a documentacao portatil da skill.

## Decisoes

### Matching de vaga viva

- **Entrada:** linhas de `job` e documentos de `profile` lidos pela REST com service-role.
- **Normalizacao:** cargo → `role_family`; titulo/descricao → senioridade e anos; local/modelo
  → elegibilidade; descricao → idioma e tecnologias.
- **Skills:** o vocabulario vem da configuracao do matcher e do Perfil Canonico. A extracao
  identifica requisitos da vaga; a pontuacao continua baseada em `skills_desired`. Termos de
  suporte conhecidos ficam explicitamente fora do alinhamento desejado.
- **Sem LLM:** esta rodada e de alto volume e permanece deterministica/barata. Julgamento LLM
  do top 15% continua como fase posterior.
- **Idempotencia:** upsert de `job_match` por `(user_id, job_id)`; uma nova rodada substitui
  score, rank, motivos, gaps e skills do mesmo par.
- **Falha de perfil:** um documento incompleto falha apenas aquele usuario e torna o ciclo
  visivelmente incompleto, sem misturar dados entre contas.
- **Associacao inicial:** `profile:sync` exige `PROFILE_USER_ID` ou `--user-id`; nunca escolhe
  implicitamente a primeira conta do banco.

### Operacao

- `python3 -m engine.run_cycle` executa coleta, persiste `source_run` e calcula matches.
- Workflow `engine-cycle.yml`: cron `17 */6 * * *`, `workflow_dispatch`, concorrencia unica.
- Secrets existentes: `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- Nenhum container long-lived: o engine e batch puro e termina a cada ciclo.

### Saude das fontes

`source_run` e global e append-only: `run_id`, fonte, modo, status, contagem, erro e instante.
RLS permite leitura a autenticados; apenas service-role grava. O backend consulta as ultimas
execucoes e nao deduz mais “ok” pela mera existencia de vagas antigas.

## Fases

### Fase 1 — Banco

Aplicar `source_run`, indices, grants e RLS. Validar REST com service-role e bloqueio anonimo.

### Fase 2 — Engine

1. Estender o cliente REST somente onde necessario.
2. Criar `engine/matching/live.py` com normalizacao e persistencia multiusuario.
3. Registrar execucoes de fonte no coletor.
4. Criar `engine/run_cycle.py`.
5. Cobrir extracao, separacao de suporte, payload, isolamento e falhas.

### Fase 3 — Backend

1. Adicionar `SourceRunRow` ao contrato.
2. Buscar ultimas execucoes em `JobModel.listByUser`.
3. Manter fallback derivado somente enquanto nao houver nenhuma execucao registrada.
4. Incluir `source_run` no readiness.

### Fase 4 — Agendamento e skill

1. Criar workflow agendado/manual.
2. Restaurar apenas o commit de documentacao da skill `url-slug`.
3. Atualizar README operacional.

### Fase final — Validacao

- Testes Python filtrados do normalizador, persistencia, coletor e ciclo.
- Testes Jest filtrados de `JobModel`/`JobController` e componentes afetados.
- Typecheck e lint dos dois workspaces.
- Ciclo real contra Supabase: 30 vagas e 30 matches para o usuario atual.
- Backend `/ready` 200 e fontes com timestamp/status real.
- Workflow validado e PR aberto em portugues.

## Fluxo desejado

```text
GitHub Actions (6h/manual)
        │
        ▼
engine.run_cycle
        ├── coleta adaptadores ──► job (upsert global)
        ├── registra execucoes ──► source_run (append-only)
        └── para cada profile
              ├── normaliza vagas vivas
              ├── Matcher deterministico
              └── job_match (upsert por usuario+vaga)
                                      │
                                      ▼
Express /jobs ──► radar + saude real das fontes
```
