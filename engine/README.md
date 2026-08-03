# Engine do 10xVagas

Motor Python de descoberta e matching.

```text
engine/
├── experiment/   Perfil Canonico, amostra de 30 vagas e baseline explicavel
├── matching/     normalizacao e score das vagas persistidas por usuario
└── sources/      contrato SourceAdapter, adaptadores e persistencia de vagas
```

## Validacao

```bash
python3 -m unittest discover -s engine/experiment/tests -v
python3 -m unittest discover -s engine/sources/tests -v
python3 -m unittest discover -s engine/matching/tests -v
python3 -m compileall -q engine
```

## Coleta

```bash
export SUPABASE_URL=https://seu-projeto.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=sua-chave-secreta
python3 -m engine.sources.collect
```

O coletor faz upsert em `public.job` pela chave `(source, external_id)` usando apenas
`urllib`. Falha em uma fonte continua isolada sem derrubar as demais. Os artefatos de
`experiment/` existem somente para calibracao offline e nao alimentam a aplicacao.

Para persistir o ranking de calibracao em `job_match`, configure tambem
`MATCH_USER_ID` antes de executar `python3 engine/experiment/run_experiment.py`.

## Ciclo operacional

```bash
python3 -m engine.run_cycle
```

O ciclo coleta vagas, registra a saude de cada fonte em `source_run` e recalcula
`job_match` para cada documento em `profile`. O workflow `engine-cycle.yml` executa
esse comando a cada seis horas e tambem oferece disparo manual no GitHub Actions.

Embeddings, integracao com AI Gateway e fila Postgres ainda nao foram implementados.
O engine nao sera um segundo backend de produto: suas ferramentas Python rodarao
como jobs/consumidores da fila. A API usada pelo frontend continua exclusivamente
no Node/Express.
