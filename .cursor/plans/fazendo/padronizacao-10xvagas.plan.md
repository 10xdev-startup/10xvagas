---
name: Padronizacao do repositorio 10xVagas
overview: Remove residuos do template, alinha scripts e documentacao ao padrao 10xDev e consolida 10xVagas como nome do produto sem renomear a pasta fisica ainda.
todos: []
isProject: false
---

# `Padronizacao do repositorio 10xVagas`

---

## Problema

O monorepo tem a arquitetura correta, mas ainda mistura identidade ApplyKey/Meu Projeto, documentacao do template, showcase exposto sem uso e configuracoes divergentes das portas e do deploy. Isso dificulta entender o que e produto, experimento e infraestrutura futura.

---

## Solucao

Adotar 10xVagas como nome do produto, preservar `backend/`, `frontend/` e `engine/`, remover apenas as superficies de demonstracao sem consumidor e atualizar a fonte da verdade em README, CLAUDE, scripts, lockfile, Docker e workflow. O diretorio raiz local nao sera renomeado nesta fase.

---

## Reaproveitamento

- `package.json`: manter npm workspaces e scripts concorrentes ja alinhados a 10xDev.
- `backend/src/`: manter Controller → Model → Routes sem movimentacao cosmetica.
- `frontend/components/showcase/blocks/`: manter os blocos reutilizaveis; remover apenas galeria/rota do template.
- `engine/experiment/` e `engine/sources/`: manter separacao entre calibracao e descoberta.
- `.github/workflows/deploy.yml`: manter workflow Azure do template, mas bloquear recursos ainda nao provisionados.

---

## Checklist resumida

```text
Fase 0: Consolidar nome 10xVagas
Fase 1: Limpar residuos executaveis do template
Fase 2: Corrigir scripts, lockfile, Docker e deploy
Fase 3: Reescrever documentacao da arquitetura real
Fase final: validar backend, frontend, engine e servidor local
```

---

## Passo a passo

### Fase 0 — Identidade

**Objetivo:** interface, metadados e artefatos operacionais usam 10xVagas.

**Reaproveita:** logo geometrico existente e identidade visual atual.

1. Em `package.json`, `.env.local`, layouts e componentes → substituir nome de produto.
2. Renomear o componente de logo sem alterar o SVG.
3. Preservar referencias historicas a 10xDev no Perfil Canonico.

**Validacao parcial:** busca textual nao encontra ApplyKey em superficies ativas.

**Commit sugerido:** `refactor(marca): consolida identidade 10xVagas`

---

### Fase 1 — Limpeza do template

**Objetivo:** nenhuma rota de producao exibe a vitrine do starter kit.

**Reaproveita:** `frontend/components/showcase/blocks/` permanece como biblioteca interna.

1. Remover rota `/componentes`, galeria, indice e `RepoInsumos` sem consumidores.
2. Manter componentes atomicos que o produto ainda pode reutilizar.

**Validacao parcial:** grafo de imports nao referencia os arquivos removidos.

**Commit sugerido:** `chore(frontend): remove superficie de demonstracao do template`

---

### Fase 2 — Tooling e infraestrutura

**Objetivo:** comandos e configuracoes refletem o monorepo real e falham de modo seguro.

**Reaproveita:** workspaces e workflow Azure existentes.

1. Versionar `package-lock.json` como no repositorio 10xDev.
2. Adicionar scripts raiz para typecheck e testes segmentados.
3. Corrigir porta exposta pelo Docker do backend.
4. Renomear imagens para 10xVagas e deixar recursos Azure nao provisionados como placeholders bloqueados pelo preflight.

**Validacao parcial:** scripts raiz executam e workflow nao aponta silenciosamente ao starter kit.

**Commit sugerido:** `chore(repo): alinha tooling e infraestrutura ao padrao 10xDev`

---

### Fase 3 — Documentacao

**Objetivo:** um novo colaborador entende o estado atual sem ler o briefing original.

**Reaproveita:** convencoes detalhadas ja documentadas em `.claude/CLAUDE.md`.

1. Reescrever `README.md` com arquitetura, fronteiras, comandos e status real.
2. Atualizar `engine/README.md`, `frontend/README.md` e secao Projeto do CLAUDE.
3. Documentar que `worker/` e o container de ferramentas Python ainda nao existem e nao simular entrega futura.

**Validacao parcial:** nomes, portas e comandos da documentacao correspondem aos arquivos reais.

**Commit sugerido:** `docs(repo): documenta arquitetura real do 10xVagas`

---

### Fase final — Validacao (smoke test)

- `npm run typecheck` → 0 erros.
- `npm run lint` → 0 erros.
- testes frontend, backend e Python pertinentes passam.
- `git diff --check` → limpo.
- `/` exibe 10xVagas e `/health` responde no envelope padrao.
- `/componentes` deixa de ser uma superficie do produto.

---

## Diagrama: estado atual vs. desejado

### Atual

```text
raiz do template
├── README "Meu Projeto"
├── frontend ApplyKey + rota /componentes
├── backend Express
├── engine Python
└── deploy ainda aponta ao starter-kit
```

### Desejado

```text
10xVagas
├── frontend/              produto e radar
│   ├── app/               somente rotas do produto
│   └── components/
│       ├── ui/            primitives
│       └── showcase/blocks/  biblioteca interna preservada
├── backend/               API de produto (Controller → Model → Routes)
├── engine/
│   ├── experiment/        calibracao do matching
│   └── sources/           adaptadores e coleta
├── package.json           comandos unificados
└── .github/workflows/     Azure bloqueado ate provisionamento 10xVagas
```
