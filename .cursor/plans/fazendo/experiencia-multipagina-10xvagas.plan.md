---
name: Experiencia multipagina do 10xVagas
overview: Transformar o dashboard em um cockpit com rotas reais para Radar, Vagas salvas, Perfil Canonico e Fontes, incluindo persistencia preparada no backend e ferramenta local de importacao de CV.
todos: []
isProject: false
---

# `Experiencia multipagina do 10xVagas`

---

## Problema

A sidebar atual aponta Radar, Perfil e Fontes para a mesma pagina. O workspace de vagas nao permite salvar oportunidades, o cabecalho nao reconhece a rota e o Perfil Canonico nao possui uma superficie propria para revisar CV, intencao de carreira e criterios de busca.

---

## Solucao

Criar quatro rotas de produto com linguagem visual editorial compartilhada: `/`, `/saved`, `/profile` e `/sources`. Extrair o workspace reutilizavel de vagas, oferecer salvamento imediato por usuario no navegador com contrato Node/Supabase pronto para sincronizacao, expor o Perfil Canonico como workbench e adicionar uma ferramenta local opcional baseada em Codex CLI para gerar rascunhos versionados a partir de CV.

O Codex CLI e ferramenta de bootstrap local, nao dependencia do navegador nem runtime de producao. O fluxo web futuro envia um job para a fila; nunca executa CLI sincrono pelo frontend ou backend Node.

---

## Reaproveitamento

- `frontend/components/JobRadar.tsx`: lista, filtros e dossie viram workspace compartilhado entre Radar e Salvas.
- `frontend/lib/experiment.ts`: continua como leitura do snapshot durante a calibracao.
- `frontend/components/showcase/blocks/DiffViewer.tsx`: base futura para revisar mudancas do CV, depois de tokenizar cores.
- `frontend/components/ui/sidebar.tsx`: navegacao responsiva e colapsavel existente.
- `frontend/services/apiClient.ts`: transporte unico para o backend de vagas salvas.
- `backend/src/middleware/supabaseMiddleware.ts`: identidade obrigatoria em toda operacao persistente.
- `engine/experiment/data/canonical-profile.json`: schema e fonte inicial do workbench de perfil.

Genuinamente novo: rotas de produto, store local de salvos, dominio Node `saved-job`, apresentacao do Perfil Canonico, ledger de Fontes e CLI de importacao de perfil.

---

## Checklist resumida

```
Fase 0: auditar UX, dados existentes e fronteiras Node/Python
Fase 1: criar navegacao real e cabecalho contextual
Fase 2: extrair workspace e implementar salvar vagas
Fase 3: criar workbench do Perfil Canonico e ferramenta de CV
Fase 4: criar ledger operacional de Fontes
Fase 5: preparar persistencia Node/Supabase para saved_jobs
Fase final: validar desktop, mobile, tipos, lint e testes focados
```

---

## Passo a passo

### Fase 1 — Navegacao e shell

**Objetivo:** cada item da sidebar leva a uma rota com contexto proprio.

1. Em `frontend/components/AppSidebar.tsx`, trocar ancoras por `/saved`, `/profile` e `/sources`, corrigir estado ativo e fechar a sidebar mobile ao navegar.
2. Em `frontend/components/DashboardHeader.tsx`, resolver titulo/subtitulo por pathname.
3. Em `frontend/app/(dashboard)/layout.tsx`, usar o cabecalho contextual.

**Validacao parcial:** cada item abre URL distinta, recebe estado ativo e mantem tema/sidebar.

**Commit sugerido:** `feat(navegacao): cria rotas reais do cockpit`

---

### Fase 2 — Vagas salvas

**Objetivo:** permitir criar e revisar uma shortlist sem perder o contexto da vaga.

1. Refatorar `JobRadar` para modo reutilizavel e adicionar acao salvar com `aria-pressed`.
2. Criar store local por usuario para feedback imediato e pagina `/saved` com vazio editorial.
3. Criar contrato frontend/backend para listar, salvar idempotentemente e remover snapshots de vagas.

**Validacao parcial:** salvar no Radar atualiza contador e pagina Salvas; remover atualiza as duas superficies.

**Commit sugerido:** `feat(vagas): adiciona shortlist de oportunidades`

---

### Fase 3 — Perfil Canonico

**Objetivo:** transformar o JSON de calibracao em uma superficie compreensivel e revisavel.

1. Criar loader tipado do perfil e pagina `/profile`.
2. Separar visualmente stack conhecida, stack desejada e stack excluida do matching.
3. Expor preferencias BH/regiao, remoto internacional e fatos pendentes.
4. Adicionar ferramenta local `engine` que produz rascunho versionado a partir de texto/PDF e pode usar Codex CLI opcionalmente.

**Validacao parcial:** pagina apresenta dados reais do perfil; ferramenta preserva helpdesk fora de `skills_desired` e passa testes.

**Commit sugerido:** `feat(perfil): cria workbench e importacao local de cv`

---

### Fase 4 — Fontes

**Objetivo:** dar visibilidade sobre cobertura, saude e limites de cada fonte.

1. Criar `/sources` como ledger agrupado em ATS automaticos e busca assistida.
2. Mostrar status, contagem, modo, ultima coleta e acao contextual.
3. Explicar LinkedIn/Indeed sem prometer scraping, login ou candidatura automatica.

**Validacao parcial:** falha de uma fonte fica isolada e as fontes assistidas abrem consultas seguras.

**Commit sugerido:** `feat(fontes): cria painel de cobertura do radar`

---

### Fase 5 — Persistencia Node/Supabase

**Objetivo:** preparar sincronizacao multiusuario da shortlist sem acoplar o frontend ao banco.

1. Criar dominio `saved-job` em Controller → Model → Routes.
2. Exigir `req.user.id`, snapshot normalizado e save idempotente por `(user_id, job_key)`.
3. Documentar o DDL com RLS para aplicar via Management API quando o PAT estiver disponivel; nao criar migration SQL.

**Validacao parcial:** testes de controller/model cobrem isolamento por usuario, idempotencia e remocao.

**Commit sugerido:** `feat(vagas): prepara persistencia de vagas salvas`

---

### Fase final — Validacao (smoke test)

- `npm run typecheck -w backend` e `npm run lint -w backend`.
- `npm run typecheck -w frontend` e `npm run lint -w frontend`.
- Testes Jest pertinentes, sempre filtrados.
- Testes Python pertinentes do importador/perfil.
- Desktop: navegar pelas quatro telas, salvar e remover uma vaga.
- Mobile: selecionar vaga abre detalhe visivel; voltar retorna a lista.
- Edge: lista de salvos vazia, perfil com fatos pendentes, fonte com erro e CV sem texto extraivel.

---

## Diagrama: estado atual vs. desejado

### Atual

```text
Sidebar ──► / ──► Radar + Perfil + Fontes na mesma pagina
                         └─ vagas sem shortlist
```

### Desejado

```text
Sidebar
  ├──► /          Radar + workspace de decisao
  ├──► /saved     Shortlist por usuario
  ├──► /profile   Perfil Canonico + criterios + CV
  └──► /sources   Ledger de cobertura

Radar/Salvas ──► store imediato ──► apiClient ──► Node saved-job ──► Supabase + RLS

CV local ──► engine tool ──► rascunho versionado ──► revisao humana
                 └─ Codex CLI opcional apenas no bootstrap local
```
