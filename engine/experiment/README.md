# Experimento inicial de matching

Este spike responde uma unica pergunta antes da construcao do produto: o
10xVagas consegue colocar no top 10 pelo menos 6 das 10 vagas que Augusto
colocaria?

Nao ha UI, servico HTTP Python, banco, fila, Playwright, embeddings ou LLM nesta entrega. As
30 vagas foram lidas e normalizadas manualmente, e o baseline usa somente os
campos estruturados. Isso isola pesos e filtros, deixa cada ponto explicavel e
evita investir no pipeline antes de validar a hipotese.

## Artefatos

- `data/canonical-profile.json`: fatos e narrativas PT/EN extraidos das cinco
  fontes fornecidas. Narrativas sao rascunhos; fatos ausentes continuam
  explicitamente pendentes.
- `data/jobs.json`: snapshot de 30 vagas, 15 BR e 15 internacionais, coletado em
  31/07/2026. Mantem URL e remuneracao original quando publicada.
- `config/matching-weights.json`: todos os pesos, aliases, penalidades e filtros.
- `output/human-ranking.csv`: planilha cega que deve ser preenchida primeiro.
- `output/system-ranking.json`: resultado explicavel do baseline. Nao abra antes
  de concluir a planilha humana.

Links de vagas expiram. `available_at_collection` significa apenas que a pagina
publica estava disponivel durante a coleta; este snapshot nao promete que a
empresa continuara recebendo candidaturas depois dessa data.

## Protocolo cego

1. Revise `data/canonical-profile.json`, principalmente
   `facts_pending_confirmation`. Corrija fatos antes de ranquear.
2. Abra apenas `output/human-ranking.csv`.
3. Preencha `rank` com cada numero de 1 a 30 exatamente uma vez. Use `notes` para
   registrar criterios pessoais que o dataset nao capturou.
4. Nao abra `output/system-ranking.json` antes de salvar o ranking humano.
5. Execute:

   ```bash
   python3 engine/experiment/compare_rankings.py
   ```

6. Leia `output/comparison-report.json`. A metrica primaria e a intersecao dos
   dois conjuntos top 10; o experimento passa com 6 ou mais vagas em comum.

O RBO aparece apenas como diagnostico de ordenacao. Ele nao substitui a metrica
combinada definida no briefing.

## Regerar o baseline

Depois de mudar perfil, vagas ou pesos:

```bash
python3 engine/experiment/run_experiment.py
```

O comando atualiza o ranking do sistema, mas preserva uma planilha humana ja
existente. Para recomecar um teste cego, mova a planilha preenchida para outro
nome e apague apenas `output/human-ranking.csv` antes de executar novamente.

## Como o score funciona

O score vai de 0 a 100 e soma cinco componentes configuraveis:

- alinhamento com `skills_desired`;
- cobertura de requisitos obrigatorios com evidencia real;
- familia de papel;
- distancia de experiencia profissional exigida;
- evidencia transferivel em produto/startup e IA.

Gaps tecnicos obrigatorios e graduacao concluida geram penalidades configuradas.
Experiencia em suporte, Office 365, AnyDesk, redes, VPN e helpdesk fica fora dos
dois componentes de skill: ela nao pode elevar o score, mesmo quando uma vaga a
menciona.

Somente os filtros com fatos confirmados podem eliminar uma vaga. Hoje entram
modelo de trabalho e idioma: remoto e aceito em qualquer mercado; hibrido, apenas
em Belo Horizonte e regiao metropolitana. Regime, autorizacao, salario,
senioridade alvo e disponibilidade permanecem desligados ate a confirmacao dos
campos pendentes do perfil.

## Validacao tecnica

```bash
python3 -m unittest discover -s engine/experiment/tests -v
python3 -m compileall -q engine/experiment
```
