---
name: Validacao inicial do matching
overview: Extrair o Perfil Canonico bilingue, congelar 30 vagas reais e validar um ranking configuravel contra o top 10 humano antes de construir o pipeline.
todos: []
isProject: false
---

# `Validacao inicial do matching`

---

## Problema

O maior risco do 10xVagas e construir descoberta, fila e automacao em torno de um matcher que confunde experiencia anterior em suporte com o trabalho de desenvolvimento desejado.

---

## Solucao

Criar um experimento local, sem UI, banco, worker ou servicos, com perfil e vagas congelados, pesos externos ao codigo, ranking explicavel e comparacao cega entre o top 10 humano e o top 10 do sistema.

---

## Checklist resumida

```text
Fase 0: Extrair fatos e narrativas bilingues das fontes fornecidas
Fase 1: Normalizar 15 vagas BR e 15 internacionais verificaveis
Fase 2: Implementar filtros e score explicavel com pesos em JSON
Fase 3: Gerar planilha cega para ranking humano e relatorio do sistema
Fase final: Validar schema, regras criticas, determinismo e fluxo de comparacao
```

---

## Passo a passo

### Fase 0 — Perfil Canonico

**Objetivo:** representar somente fatos sustentados pelo curriculo, portfolio e briefing, sem inventar preferencias ausentes.

1. Em `engine/experiment/data/canonical-profile.json` → registrar fatos bilingues, experiencia, projetos, idiomas e `skills_known` separado de `skills_desired`.
2. Em `engine/experiment/data/canonical-profile.json` → marcar autorizacao, regimes, salario, disponibilidade e senioridade alvo como pendencias explicitas quando nao constarem das fontes.
3. Em `engine/experiment/data/canonical-profile.json` → criar bios e historias STAR bilingues como rascunhos; nao fabricar historias de conflito ou falha.

**Validacao parcial:** o perfil passa no validador e nenhuma tecnologia exclusiva de suporte aparece em `skills_desired`.

**Commit sugerido:** `feat(engine): extrai perfil canonico bilingue para experimento`

---

### Fase 1 — Amostra de vagas

**Objetivo:** congelar uma amostra auditavel de 30 vagas reais, dividida igualmente entre mercado brasileiro e internacional.

1. Em `engine/experiment/data/jobs.json` → registrar URL, data de coleta, localizacao, idioma, regime, senioridade, salario original e requisitos normalizados.
2. Preservar campos desconhecidos como `null`; nao inferir autorizacao ou remuneracao ausente.
3. Incluir bons matches e negativos dificeis para expor vazamento de senioridade, stack e trabalho de suporte.

**Validacao parcial:** 30 IDs unicos, 15 vagas BR, 15 internacionais e URL publica em todas.

**Commit sugerido:** `data(engine): congela amostra inicial de trinta vagas`

---

### Fase 2 — Ranking baseline

**Objetivo:** produzir um baseline barato e explicavel que possa ser ajustado sem deploy.

1. Em `engine/experiment/config/matching-weights.json` → externalizar pesos, aliases, penalidades e tolerancias.
2. Em `engine/experiment/matcher.py` → aplicar apenas filtros cujos fatos do perfil estejam confirmados.
3. Pontuar aderencia da stack desejada, papel desejado, senioridade, experiencia transferivel e gaps obrigatorios.
4. Ignorar `skills_known` nao desejadas no score positivo e registrar motivos/gaps por vaga.

**Validacao parcial:** mudar um peso nao exige alterar Python; skills de suporte nao elevam score; duas execucoes geram a mesma ordem.

**Commit sugerido:** `feat(engine): adiciona baseline explicavel de matching`

---

### Fase 3 — Comparacao cega

**Objetivo:** medir quantas vagas do top 10 humano aparecem no top 10 do sistema sem contaminar o julgamento humano.

1. Em `engine/experiment/run_experiment.py` → gerar ranking do sistema e CSV humano sem scores.
2. Em `engine/experiment/compare_rankings.py` → validar ranking humano completo e calcular intersecao top 10, precision/recall do conjunto e RBO simplificado como diagnostico secundario.
3. Em `engine/experiment/README.md` → documentar o protocolo cego e a meta minima de 6/10.

**Validacao parcial:** comparacao recusa ranking incompleto/duplicado e retorna aprovacao somente com intersecao maior ou igual a 6.

**Commit sugerido:** `feat(engine): cria protocolo cego de avaliacao do top dez`

---

### Fase final — Validacao (smoke test)

- `python3 -m unittest discover -s engine/experiment/tests -v` → 0 falhas.
- `python3 engine/experiment/run_experiment.py` → gera os dois artefatos esperados.
- `python3 -m compileall -q engine/experiment` → 0 erros.
- Confirmar 30 vagas, divisao 15/15 e URLs unicas.
- Confirmar que Office 365, AnyDesk, redes, VPN e helpdesk nao geram pontos positivos.
- Confirmar que filtros sem valor confirmado no perfil nao eliminam vagas.
- Cenario E2E: preencher `human-ranking.csv`, executar comparador e receber a metrica top-10.
- Edge case: ranking com ID repetido ou ausente falha com mensagem acionavel.

---

## Diagrama: estado desejado

```text
curriculos + portfolio + briefing             (fontes existentes)
                 │
                 ▼
canonical-profile.json                        ✨ NOVO
  ├─ skills_known
  ├─ skills_desired                          ◄── unica stack que pontua positivamente
  └─ facts_pending_confirmation
                 │
                 ├──────────────────────┐
                 ▼                      ▼
jobs.json (15 BR + 15 INTL)       matching-weights.json   ✨ NOVOS
                 │                      │
                 └──────────┬───────────┘
                            ▼
matcher.py                                        ✨ NOVO
  ├─ filtros confirmados
  ├─ score explicavel
  └─ motivos + gaps
             │
             ├──► system-ranking.json            ✨ NOVO — nao abrir antes do ranking humano
             └──► human-ranking.csv               ✨ NOVO — ordem inicial neutra, sem score
                            │
                            ▼
compare_rankings.py                               ✨ NOVO
             ┌────────────────────────────────────────────┐
             │ metrica primaria: intersecao top 10 >= 6  │
             └────────────────────────────────────────────┘
```
