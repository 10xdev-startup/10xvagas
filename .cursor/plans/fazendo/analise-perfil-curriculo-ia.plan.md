---
name: analise-perfil-curriculo-ia
overview: Implementar upload privado, analise assincrona e aprovacao do Perfil Canonico com engine Python, Stripe LLM Gateway e billing namespaced liquidado pelo backend Node.
todos: []
isProject: false
---

# `Analise de Perfil Canonico e curriculo com IA`

---

## Problema

O Perfil Canonico so pode ser importado localmente pelo Codex CLI. O usuario nao consegue
enviar um curriculo pelo produto, acompanhar a analise, revisar um rascunho ou aprova-lo.
Tambem nao existe job persistido, historico de consumo por chamada ou politica de debito
que permita liberar o checkout Stripe com seguranca.

---

## Solucao

Criar o dominio `profile-analysis` no backend Node e uma fila PostgreSQL consumida pelo
engine Python. O backend recebe e valida o upload, guarda o documento num bucket privado,
cria o job, expoe status/cancelamento/retry/aprovacao e liquida o consumo no Customer
Balance. O engine reclama jobs atomicamente, extrai o documento, monta contexto,
consulta o Stripe LLM Gateway, valida o contrato e persiste um rascunho auditavel.

Decisoes registradas antes do codigo:

1. **Gateway:** Stripe LLM Gateway e o unico transporte de LLM desta feature. Nao chamar
   provider direto nem encadear o `ai-gateway` proprio. O gateway automatico pode emitir
   `token-billing-tokens`; a telemetria do produto continua manual em `10xvagas_tokens`.
2. **Modelo inicial:** `gpt-5.6-terra`, centralizado num catalogo e chamado por
   `/responses` com tool estruturada. Comecar com um modelo selecionavel evita rate card
   especulativo; historicos preservam descritores aposentados como `selectable: false`.
3. **Cobranca:** tokens geram custo financeiro; `10xvagas_profile_extracted` e somente
   telemetria de sucesso. O engine nunca movimenta dinheiro: grava uso `pending`; um
   settler Node calcula a rate exata e cria Customer Balance Transaction idempotente.
4. **Credito:** a criacao exige Customer namespaced e saldo disponivel maior que zero. O
   debito real pode consumir o saldo restante; saldo Stripe positivo representa o pequeno
   excedente da ultima chamada e bloqueia novas analises ate novo credito. Checkout fica
   `false` ate o fluxo de debito passar no smoke live.
5. **Retry:** cria novo job com `retry_of_job_id`; o job anterior e historico imutavel.
   Identifiers de meter/debito sao derivados do `ai_usage_event.id`, nao da request HTTP.
6. **Aprovacao:** resultado e sempre rascunho. Uma RPC transacional aprova a analise e
   atualiza `profile.document`; nunca ha ativacao automatica.
7. **Upload:** `multipart/form-data` via backend com limite de 8 MiB. Bucket
   `profile-documents` privado; caminho `<user_id>/<job_id>/<safe_name>`. Frontend nunca
   recebe URL permanente.
8. **Formatos:** PDF por `pdftotext`, DOCX por `zipfile` + XML da stdlib e TXT UTF-8.
9. **Execucao:** worker Python separado, com `--once` para testes e loop com heartbeat
   para runtime. O deploy do engine e uma fase separada para nao quebrar os Web Apps
   atuais antes de existir `web-engine-10xvagas`.
10. **Banco:** nao criar migration SQL. O DDL idempotente foi aplicado pelo SQL Editor
    em 2026-08-03 e permaneceu fora do repo. A introspeccao REST confirmou as tres
    tabelas, as tres RPCs e o bucket privado; claims concorrentes de job e usage
    entregaram o registro sentinela para exatamente um entre dois workers.

---

## Checklist resumida

```text
Fase 0: Fechar schema, contrato e DDL idempotente
Fase 1: Criar dominio backend de upload, jobs, historico e aprovacao
Fase 2: Criar worker Python, parsing, contexto, gateway e validacao
Fase 3: Registrar uso, emitir meters e liquidar Customer Balance no Node
Fase 4: Construir workbench de upload, progresso, resultado, diff e aprovacao
Fase 5: Aplicar DDL, integrar localmente e validar seguranca/recuperacao
Fase 6: Containerizar e implantar o engine worker — separado
Fase final: Quality gate, smoke E2E, documentacao e PR
```

---

## Passo a passo

### Fase 0 — Contratos e banco

**Objetivo:** definir uma fila recuperavel, resultados imutaveis ate aprovacao e billing
idempotente sem acoplar Node e Python por HTTP.

1. Definir em `backend/src/types/profileAnalysis.ts` os estados, inputs e DTOs publicos.
2. Definir em `engine/profile/analysis_schema.json` o contrato estruturado completo:
   perfil proposto, diagnostico, evidencias e perguntas pendentes.
3. Preparar e aplicar por Management API, sem arquivo `.sql`:
   - bucket privado `profile-documents`, limite 8 MiB e MIME allowlist;
   - `profile_analysis_job` com lease, heartbeat, progresso, retry e cancelamento;
   - `profile_analysis` com rascunho, diagnostico, evidencias e aprovacao;
   - `ai_usage_event` com usage, identifiers e settlement;
   - indices de fila, unicidade de job ativo e RLS por dono;
   - RPC `claim_profile_analysis_job` com `FOR UPDATE SKIP LOCKED`;
   - RPC `claim_ai_usage_event` com `FOR UPDATE SKIP LOCKED`;
   - RPC transacional `approve_profile_analysis`.
4. Confirmar que service-role e funcoes nao permitem selecionar job de outro usuario
   pela API de produto.

**Validacao parcial:** introspeccao confirma tabelas, indices, RLS, policies, funcoes e
bucket privado; duas claims concorrentes devolvem o mesmo job para apenas um worker.

**Executado em 2026-08-03:** bucket privado com limite de 8 MiB e allowlist de MIME;
`profile_analysis_job`, `profile_analysis` e `ai_usage_event` expostas no schema REST;
RPCs `claim_profile_analysis_job`, `claim_ai_usage_event` e
`approve_profile_analysis` disponiveis somente ao service role. Dois requests
concorrentes resultaram em uma unica claim nas duas filas, e o cleanup deixou zero
registros sentinela. O smoke da aprovacao bloqueou um `user_id` incorreto e confirmou
que somente a chamada do dono atualiza `profile.document` e `approved_at`.

**Commit sugerido:** `feat(perfil): definir contratos da analise assincrona`

---

### Fase 1 — Backend Node: produto e upload

**Objetivo:** expor uma API curta, autenticada e independente da disponibilidade do engine.

1. Em `backend/src/models/ProfileAnalysisModel.ts` implementar todo acesso a
   `profile_analysis_job` e `profile_analysis`, sempre filtrando `user_id` mesmo com
   service-role.
2. Em `backend/src/services/profileDocumentService.ts`:
   - validar assinatura real de PDF/DOCX e UTF-8 de TXT;
   - normalizar nome sem confiar no cliente;
   - enviar para o bucket privado;
   - remover o objeto quando a criacao do job falhar.
3. Em `backend/src/controllers/ProfileAnalysisController.ts` implementar:
   - `POST /profile-analyses` — upload, preferencias, customer/saldo e job `queued`;
   - `GET /profile-analyses` — historico do dono;
   - `GET /profile-analyses/:id` — job + resultado projetado;
   - `POST /profile-analyses/:id/cancel` — `cancel_requested` cooperativo;
   - `POST /profile-analyses/:id/retry` — novo job ligado ao anterior;
   - `POST /profile-analyses/:id/approve` — valida patch editavel e chama RPC atomica.
4. Em `backend/src/routes/profileAnalysisRoutes.ts` registrar middleware multipart
   somente nesta rota; nunca aumentar o limite JSON global.
5. Registrar a rota em `backend/src/index.ts` e incluir as novas tabelas no `/ready`.
6. Toda resposta por `sendOk`; erros de dominio por `AppError`; `user_id` so de
   `req.user`.

**Validacao parcial:** testes focados cobrem upload invalido, tamanho, isolamento, job
ativo duplicado, cancelamento, retry, aprovacao e envelopes.

**Commit sugerido:** `feat(perfil): criar API de analise e upload privado`

---

### Fase 2 — Engine Python: analise estruturada

**Objetivo:** transformar um documento privado em rascunho auditavel sem bloquear HTTP.

1. Extrair de `engine/profile/import_profile.py` as funcoes puras reutilizaveis sem
   quebrar a CLI existente.
2. Adicionar leitura DOCX por stdlib e preservar PDF/TXT.
3. Em `engine/profile/analysis_context.py` montar o prompt a partir de:
   - documento extraido;
   - preferencias declaradas;
   - perfil ativo atual;
   - regras anti-invencao;
   - separacao `skills_desired` / `skills_known`;
   - idioma e versao do prompt.
4. Em `engine/llm/catalog.py` registrar `gpt-5.6-terra` como unico modelo novo
   selecionavel e resolver modelos persistidos separadamente.
5. Em `engine/llm/stripe_gateway.py` chamar `/responses` com urllib, timeout, tool
   estruturada e captura de `input`, `output`, `cached`, response id e modelo retornado.
6. Em `engine/profile/analysis_worker.py`:
   - claim atomica;
   - download do unico objeto associado ao job;
   - heartbeat e verificacao de cancelamento entre etapas;
   - extracao deterministica;
   - chamada LLM;
   - validacao completa do schema;
   - merge que preserva `skills_desired` declaradas pelo usuario;
   - persistencia de `profile_analysis` e finalizacao do job;
   - limpeza do temporario em `finally`.
7. Job com lease expirado volta para claim; job `succeeded` nunca reexecuta.

**Validacao parcial:** unittest com gateway/Supabase mockados cobre claim concorrente,
PDF/DOCX/TXT, cancelamento, lease, schema invalido, proveniencia e exclusao de helpdesk.

**Commit sugerido:** `feat(engine): processar analise de perfil em background`

---

### Fase 3 — Usage, rates e liquidacao

**Objetivo:** registrar e cobrar exatamente o consumo real uma unica vez.

1. Criar rate card live isolado `10xVagas - Rate Card BRL`; nunca reutilizar IDs dos
   outros produtos.
2. Criar apenas as rates `input`, `output` e `cached` de `gpt-5.6-terra`, apontando
   para o meter `10xvagas_tokens`; conferir unicidade por `(meter, model, token_type)`.
3. Configurar `STRIPE_RATE_CARD_ID` e `PROFILE_ANALYSIS_MODEL_ID` local/Azure, sem
   segredos no repo.
4. Antes da LLM, inserir `ai_usage_event` com `call_id` persistido e status `started`.
5. Depois da resposta:
   - gravar usage e identifiers deterministicos;
   - emitir `10xvagas_tokens` por tipo com valor positivo;
   - marcar settlement `pending`;
   - emitir `10xvagas_profile_extracted` somente apos resultado valido.
6. Em `backend/src/services/aiUsageSettlementService.ts`:
   - claim atomica de evento pendente;
   - carregar rates do rate card da 10xVagas;
   - exigir correspondencia exata e sem duplicidade;
   - calcular centavos com decimal seguro;
   - criar Customer Balance Transaction positiva com idempotency key
     `10xvagas_usage_<usage_event_id>`;
   - marcar `settled` ou erro retomavel.
7. Iniciar o settler no backend com intervalo curto, trava de concorrencia e `unref()`.
8. Checkout permanece desligado ate smoke live confirmar compra, webhook, analise,
   debito e saldo final.

**Validacao parcial:** testes provam que retry do settler nao duplica debito, rate ausente
falha fechada, namespace estranho e rejeitado e feature event nao gera segundo debito.

**Commit sugerido:** `feat(billing): liquidar consumo da analise por tokens`

---

### Fase 4 — Workbench do Perfil Canonico

**Objetivo:** trocar a instrucao de CLI por uma experiencia clara de upload e revisao.

1. Criar `frontend/types/profileAnalysis.ts` e
   `frontend/services/profileAnalysisService.ts` sobre `apiClient.upload`.
2. Transformar `/profile` numa superficie que combina perfil ativo e ultima analise,
   sem expor contato/narrativas privadas indevidas no Server Component.
3. Substituir “Importar com Codex CLI” por:
   - dropzone PDF/DOCX/TXT;
   - cargos, stack desejada, foco, idioma e mercado;
   - modelo/custo estimado quando disponivel;
   - saldo e CTA de creditos.
4. Mostrar estados: validando, fila, extraindo, analisando, preparando, aguardando
   aprovacao, falhou, cancelado e concluido.
5. Polling para enquanto o job for terminal; perfil ativo permanece visivel.
6. Resultado em workbench, nao chat:
   - resumo de posicionamento;
   - diagnostico priorizado;
   - perguntas pendentes;
   - evidencias e confianca;
   - PT/EN;
   - `DiffViewer` para atual versus proposto;
   - editor do patch permitido e aprovacao explicita.
7. Historico, cancelamento e retry com feedback por toast e estados acessiveis.

**Validacao parcial:** testes frontend cobrem upload, polling, cancelamento, falha,
insuficiencia de saldo, diff, aprovacao e perfil ativo durante processamento.

**Commit sugerido:** `feat(frontend): criar workbench de analise do curriculo`

---

### Fase 5 — Integracao e recuperacao

**Objetivo:** provar o fluxo completo e os cenarios que normalmente causam duplicidade.

1. Adicionar scripts raiz `profile:worker` e `profile:worker:once`.
2. Rodar backend `localhost:3001`, frontend `localhost:3000` e worker separado.
3. Testar upload real de PDF, DOCX e TXT.
4. Derrubar o worker no meio da analise, aguardar lease e confirmar retomada.
5. Cancelar durante extracao e antes da LLM.
6. Repetir polling/retry e conferir uma unica analise/debito por call id.
7. Confirmar que logs nao contem texto, contato, segredo ou URL assinada.

**Validacao parcial:** E2E local completo e consultas read-only de jobs, usage, meters e
Customer Balance confirmam o contrato.

**Executado sem consumo em 2026-08-03:** backend respondeu `ready` em
`localhost:3001`; frontend respondeu a landing em `localhost:3000` e protegeu
`/profile` sem sessao com redirect para a LP; o engine `--once` conectou ao Supabase,
encontrou a fila vazia e encerrou sem chamar o LLM. O E2E pago com curriculo real e a
liquidacao live continuam bloqueados de proposito ate existir um Customer de teste com
credito controlado.

**Commit sugerido:** `test(perfil): validar fluxo assincrono e recuperacao`

---

### Fase 6 — Engine em producao (separada)

**Objetivo:** executar o worker continuamente sem acopla-lo ao Web App Node.

1. Criar `engine/Dockerfile` com Python 3.12, `poppler-utils`, usuario nao-root e
   entrypoint do worker.
2. Criar/configurar `web-engine-10xvagas` ou recurso equivalente always-on na Azure.
3. Somente depois do recurso existir, adicionar build/push/deploy da imagem ao workflow.
4. Configurar `SUPABASE_URL`, service role, Stripe key e modelo via Azure CLI.
5. Confirmar heartbeat e retomada apos restart do container.

**Validacao parcial:** job criado em producao e reclamado pelo engine, sem processo Python
dentro do backend Node.

**Provisionado em 2026-08-03:** `web-engine-10xvagas` foi criado no App Service Plan B1
existente, com `Always On`, `/health`, porta 8000 e variaveis runtime configuradas sem
expor valores. O recurso permanece parado ate o merge; o workflow passa a construir,
publicar, configurar e reiniciar a imagem `10xvagas-engine` junto dos demais servicos.

**Commit sugerido:** `ci(engine): implantar worker de analise na Azure`

---

### Fase final — Validacao e entrega

- `npm run typecheck -w backend` sem erros.
- `npm run lint -w backend` sem erros.
- `npm run typecheck -w frontend` sem erros.
- `npm run lint -w frontend` sem erros.
- Jest apenas dos arquivos pertinentes de profile analysis e billing.
- Unittest apenas de `engine/profile`, `engine/llm` e `engine/billing` pertinentes.
- `git diff --check` limpo.
- Smoke em `localhost:3000` + `localhost:3001` + worker Python.
- Edge case: dois workers concorrentes, um claim; retry do settlement, um debito.
- Atualizar `.claude/skills/stripe-setup/SKILL.md` com rate card e operacao aprendida.
- Mover este plano para `.cursor/plans/feitos/` somente apos todas as validacoes.
- Abrir PR em portugues, incluindo DDL aplicado, variaveis, recursos Stripe e smoke.

---

## Diagrama: estado atual vs. desejado

### Atual

```text
/profile                                    (existente)
   │
   ├── perfil ativo vindo direto do Supabase no Server Component
   └── bloco "Importar com Codex CLI"
              │
              ▼
       engine/profile/import_profile.py     (existente — execucao local manual)
              │
              └── JSON local → sync manual

Stripe                                      (existente)
   ├── meters 10xvagas_* ativos
   ├── credit packs ativos
   └── checkout bloqueado                   ◄── sem politica de debito
```

### Desejado

```text
frontend /profile                           (existente — vira workbench)
   │ POST multipart /profile-analyses
   ▼
ProfileAnalysisController                   ✨ NOVO — auth, upload, CRUD e aprovacao
   ├── ProfileDocumentService               ✨ NOVO — valida e guarda privado
   ├── ProfileAnalysisModel                 ✨ NOVO — sempre filtra user_id
   └── Billing guard                        (existente — Customer namespaced + saldo)
              │
              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ profile_analysis_job                 fila PostgreSQL persistida      │
│ claim_profile_analysis_job()         FOR UPDATE SKIP LOCKED          │
│ profile_analysis                     rascunho + diagnostico          │
│ ai_usage_event                       usage + settlement persistido   │
└──────────────────────────────────────────────────────────────────────┘
              │ claim
              ▼
engine/profile/analysis_worker.py             ✨ NOVO — processo separado
   ├── PDF / DOCX / TXT
   ├── profileAnalysisPromptContext
   ├── Stripe LLM Gateway /responses
   ├── schema + regras anti-invencao
   ├── 10xvagas_tokens                        telemetria namespaced
   └── 10xvagas_profile_extracted             uma vez no sucesso
              │ usage pending
              ▼
AiUsageSettlementService                      ✨ NOVO — backend Node
   ├── rate card exclusivo 10xVagas
   ├── custo exato model + token_type
   └── Customer Balance Transaction idempotente

frontend faz polling
   ├── progresso / cancelamento / retry
   ├── diagnostico e evidencias
   ├── DiffViewer atual × proposto
   └── aprovacao explicita
              │ RPC transacional
              ▼
profile.document                              (existente — so muda ao aprovar)
              │
              └── matching posterior em background
```
