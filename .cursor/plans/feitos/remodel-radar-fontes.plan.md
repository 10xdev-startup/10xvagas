---
name: Remodel do radar e fontes de vagas
overview: Troca o dashboard generico por um workspace editorial de vagas e cria coleta explicavel por APIs publicas, preservando LinkedIn e Indeed como fontes assistidas sem scraping.
todos: []
isProject: false
---

# `Remodel do radar e fontes de vagas`

---

## Problema

A tela atual repete cards e badges com pouca hierarquia, parece uma demonstracao de dashboard e nao ajuda a comparar uma vaga com profundidade. O snapshot manual tambem guarda apenas resumos; nao existe contrato de adaptador nem coleta reproduzivel de descricoes completas.

---

## Solucao

Transformar a pagina principal em um radar com lista densa e dossie da vaga selecionada. Criar um contrato unico de fonte e adaptadores para APIs publicas de ATS/boards. LinkedIn e Indeed ficam explicitamente assistidos por link/alerta, pois as APIs oficiais atuais sao voltadas a parceiros que publicam vagas e os termos vedam scraping automatizado.

---

## Checklist resumida

```text
Fase 0: Fixar direcao visual e politica de fontes
Fase 1: Criar contrato e adaptadores publicos
Fase 2: Coletar descricoes e normalizar snapshot ao vivo
Fase 3: Remodelar dashboard como radar lista + dossie
Fase 4: Exibir saude e modo de cada fonte
Fase final: validar Python, frontend e cenario local
```

---

## Passo a passo

### Fase 1 — Contrato de fontes

**Objetivo:** toda fonte produzir a mesma vaga normalizada sem condicionais por plataforma.

1. Em `engine/sources/models.py` definir `SourceAdapter`, `SourceConfig` e `SourceJob`.
2. Em `engine/sources/adapters/` implementar Ashby, Greenhouse, Lever e Remotive sobre endpoints publicos.
3. Em `engine/sources/registry.json` declarar fontes ativas e fontes assistidas.
4. Em `engine/sources/tests/` validar o contrato com payloads locais, sem rede.

**Validacao parcial:** testes unitarios dos adaptadores passam e todos retornam descricao, URL original, local e modelo de trabalho.

**Commit sugerido:** `feat(fontes): cria contrato e adaptadores publicos de vagas`

---

### Fase 2 — Coleta reproduzivel

**Objetivo:** gerar um snapshot pequeno e relevante para a interface.

1. Em `engine/sources/collect.py` executar apenas fontes ativas, deduplicar e persistir JSON.
2. Aplicar filtro de relevancia inicial por familia de cargo e elegibilidade Brasil/remoto/BH.
3. Preservar descricao integral e metadados originais da fonte.

**Validacao parcial:** snapshot contem vagas atuais com descricao nao vazia e origem rastreavel.

**Commit sugerido:** `feat(fontes): coleta descricoes de vagas publicas`

---

### Fase 3 — Radar de vagas

**Objetivo:** substituir a pagina de cards por uma superficie de comparacao e decisao.

1. Em `frontend/lib/experiment.ts` expor descricao, fonte e preferencia de mercado.
2. Em `frontend/components/JobRadar.tsx` criar busca, mercados, lista densa, selecao e dossie.
3. Em `frontend/app/(dashboard)/page.tsx` reduzir hero/KPIs e priorizar o workspace.
4. Em `frontend/components/AppSidebar.tsx` alinhar a navegacao a Radar, Candidaturas, Perfil e Fontes.

**Validacao parcial:** selecionar uma vaga troca o dossie sem navegacao e preserva separacao Brasil/internacional.

**Commit sugerido:** `feat(frontend): remodela dashboard como radar de vagas`

---

### Fase 4 — Transparencia das fontes

**Objetivo:** deixar claro o que e automatico, assistido e indisponivel.

1. Exibir fonte em cada vaga e um painel compacto de cobertura.
2. Marcar LinkedIn e Indeed como assistidos, sem simular conexao inexistente.
3. Linkar cada vaga para sua pagina original; envio continua manual.

**Validacao parcial:** a interface nunca indica que LinkedIn/Indeed estao sincronizados automaticamente.

**Commit sugerido:** `feat(frontend): mostra cobertura e limites das fontes`

---

### Fase final — Validacao (smoke test)

- `python3 -m unittest discover -s engine/sources/tests -v` → 0 erros.
- `python3 -m compileall -q engine/sources` → 0 erros.
- `npm run typecheck -w backend` → 0 erros.
- `npm run lint -w backend` → 0 erros.
- `npm run typecheck -w frontend` → 0 erros.
- `npm run lint -w frontend` → 0 erros.
- Abre `/` no frontend; ve o radar, alterna mercado e seleciona uma vaga.
- A vaga selecionada mostra descricao, match, gaps, fonte e link original.
- Busca sem resultado exibe estado vazio sem quebrar o dossie.

---

## Diagrama: estado atual vs. desejado

### Atual

```text
snapshot manual (existente)
     │
     ▼
lista de cards repetidos (existente)
     └── resumo curto; descricao exige sair do 10xVagas
```

### Desejado

```text
APIs publicas
├── Ashby       ✨ NOVO
├── Greenhouse  ✨ NOVO
├── Lever       ✨ NOVO
└── Remotive    ✨ NOVO
     │
     ▼
SourceAdapter → SourceJob normalizado          ✨ NOVO
     │
     ├── descricao integral
     ├── URL e fonte originais
     ├── local/modelo de trabalho
     └── metadados para matching
     │
     ▼
JobRadar                                        ✨ NOVO
├── lista densa + filtros
└── dossie da vaga selecionada

LinkedIn / Indeed                               ✨ NOVO — modo assistido
└── busca humana/link/alerta; sem scraping ou login automatizado
```
