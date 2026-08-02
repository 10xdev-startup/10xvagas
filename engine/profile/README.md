# Importador local do Perfil Canonico

Ferramenta deterministica offline para gerar um rascunho a partir de CV, texto
livre e arquivos do portfolio. Ela parte de
`engine/experiment/data/canonical-profile.json` e, por padrao, escreve
`canonical-profile.draft.json`; o perfil em uso nao e sobrescrito.

## Importacao deterministica

```bash
python3 -m engine.profile.import_profile \
  --input /caminho/curriculo.pdf \
  --input /caminho/portfolio/src/data
```

Arquivos `.txt`, `.md`, `.json`, `.js`, `.jsx`, `.ts`, `.tsx`, `.csv` e `.html`
sao lidos apenas com a biblioteca padrao. PDF usa o executavel `pdftotext` do
`poppler-utils`. Quando ele nao estiver instalado ou o PDF for apenas uma imagem,
exporte o CV como texto e use `--input curriculo.txt` ou `--text "..."`; o erro do
comando explica esse caminho.

Revise o draft e, somente depois, atualize o perfil oficial:

```bash
python3 -m engine.profile.import_profile --input curriculo.txt --in-place
```

## Codex CLI opcional

```bash
python3 -m engine.profile.import_profile \
  --input curriculo.txt \
  --use-codex
```

Essa opcao chama o `codex exec` instalado e autenticado na maquina, com sessao
efemera e sandbox `read-only`. Nao existe SDK, API key de provider ou chamada de
LLM no backend/frontend do 10xVagas. O conteudo das fontes e enviado ao Codex CLI
local somente quando `--use-codex` for informado explicitamente. Dependendo da
configuracao do CLI, o modelo pode ser remoto; "local" aqui descreve o ponto de
integracao, nao o provider.

## Intencao de busca protegida

- Evidencia extraida alimenta `skills_known`.
- `skills_desired`, usada para ranquear vagas, e preservada por padrao.
- Suporte, helpdesk, Office 365, redes, VPN e ferramentas de acesso remoto sao
  forçados para `known_but_not_desired_for_matching`.
- Nem o extrator deterministico nem o Codex podem promover suporte para o score.

Para alterar conscientemente a busca, use uma ou mais opcoes explícitas:

```bash
python3 -m engine.profile.import_profile \
  --input curriculo.txt \
  --desired-skill "Go:3" \
  --desired-skill "Python:2"
```

Prioridades aceitas: `1` (secundaria), `2` (relevante), `3` (principal).

## Validacao

```bash
python3 -m unittest discover -s engine/profile/tests -v
python3 -m compileall -q engine/profile
```
