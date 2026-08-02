# Engine do 10xVagas

Motor Python de descoberta e matching.

```text
engine/
├── experiment/   Perfil Canonico, amostra de 30 vagas e baseline explicavel
└── sources/      contrato SourceAdapter, adaptadores e snapshot de vagas atuais
```

## Validacao

```bash
python3 -m unittest discover -s engine/experiment/tests -v
python3 -m unittest discover -s engine/sources/tests -v
python3 -m compileall -q engine
```

## Coleta

```bash
python3 -m engine.sources.collect
```

O resultado fica em `sources/output/live-jobs.json`. Falha em uma fonte e isolada e registrada sem derrubar as demais.

Embeddings, integracao com AI Gateway e fila Postgres ainda nao foram implementados.
O engine nao sera um segundo backend de produto: suas ferramentas Python rodarao
como jobs/consumidores da fila. A API usada pelo frontend continua exclusivamente
no Node/Express.
