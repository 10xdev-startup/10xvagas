# Engine do 10xVagas

Motor Python de descoberta e matching.

```text
engine/
├── experiment/   Perfil Canonico, amostra de 30 vagas e baseline explicavel
└── sources/      contrato SourceAdapter, adaptadores e persistencia de vagas
```

## Validacao

```bash
python3 -m unittest discover -s engine/experiment/tests -v
python3 -m unittest discover -s engine/sources/tests -v
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

Embeddings, integracao com AI Gateway e fila Postgres ainda nao foram implementados.
O engine nao sera um segundo backend de produto: suas ferramentas Python rodarao
como jobs/consumidores da fila. A API usada pelo frontend continua exclusivamente
no Node/Express.
