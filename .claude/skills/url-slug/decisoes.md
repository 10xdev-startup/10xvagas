# Decisões para uma migração de URL slug

Use esta referência somente quando o plano ainda não tiver fechado uma decisão. Registrar no plano
o contexto, a alternativa escolhida, as rejeitadas e o gatilho de revisão. Não copiar uma escolha
sem refazer a análise para o projeto atual.

## Índice

1. Identidade pública
2. Persistência e derivação
3. Formato e normalização
4. Entropia e comprimento
5. Compatibilidade
6. Ambiguidade
7. Rename e canonicalização
8. Resolução e autorização
9. Contrato entre backend e frontend
10. Rollout e observabilidade
11. Registro da decisão

## 1. Identidade pública

Definir qual parte da URL realmente identifica o recurso e qual parte serve apenas para leitura
humana.

Comparar:

- identificador opaco;
- slug persistido e único;
- nome decorativo combinado com identificador estável;
- chave natural do domínio.

Avaliar indexação, compartilhamento, rename, escopo de unicidade, privacidade e necessidade de
digitação manual. Não usar identificador público como mecanismo de autorização.

## 2. Persistência e derivação

Definir se o slug será armazenado ou calculado.

Para forma persistida, decidir:

- constraint de unicidade e seu escopo;
- geração concorrente e retry;
- política de alteração;
- histórico e redirects;
- backfill e manutenção.

Para forma derivada, decidir:

- componente estável que carrega a identidade;
- componente decorativo;
- custo de resolução;
- comportamento quando houver colisão;
- compatibilidade ao alterar o formato gerado.

## 3. Formato e normalização

Registrar a gramática completa:

- alfabeto aceito;
- separador;
- tratamento de caixa, unicode, acentos e espaços;
- tamanho máximo da parte textual;
- formatos sem parte textual;
- caracteres reservados e encoding;
- entradas que devem ser rejeitadas antes do banco.

Definir uma única implementação canônica ou uma fixture de contrato compartilhada entre cópias.

## 4. Entropia e comprimento

Não escolher comprimento apenas pela aparência da URL.

Verificar:

- como os IDs são gerados;
- se os bits usados são aleatórios e uniformes;
- quantidade atual e crescimento esperado de registros;
- probabilidade de colisão aceitável;
- impacto operacional de uma colisão;
- custo de carregar formatos antigos no futuro.

Para um espaço uniforme com `N` valores e `n` registros, estimar colisão pela aproximação do
aniversário:
P(colisão) ≈ 1 − e^(−n²/2N)
Se o identificador for ordenado por tempo ou tiver prefixos não aleatórios, não aplicar essa conta
sem validar a distribuição real. Entropia que não aparece na URL não ajuda o lookup.

## 5. Compatibilidade

Listar explicitamente:

- formato canônico gerado agora;
- formatos legados aceitos;
- duração do fallback;
- comportamento de links já publicados;
- tratamento de bookmarks, notificações, caches e convites;
- estratégia para dados que persistem a URL completa.

Definir se formatos legados apenas resolvem ou também são canonicalizados no carregamento.

## 6. Ambiguidade

Definir o que acontece quando mais de um registro satisfaz o identificador público.

Alternativas possíveis incluem:

- falhar de forma visível e registrar;
- aumentar a entropia do formato;
- aplicar um árbitro adicional definido pelo domínio;
- usar uma constraint que impeça a ambiguidade na escrita.

Nunca adotar “primeiro resultado” como política implícita. Documentar também o comportamento de
links antigos após rename quando o árbitro depender de informação mutável.

## 7. Rename e canonicalização

Definir:

- se rename preserva URLs antigas;
- qual forma deve aparecer após carregar link antigo;
- redirect HTTP, replace do roteador ou manutenção da URL original;
- preservação de query, hash e subrota;
- efeitos de remount, refetch e subscriptions;
- política de histórico quando o slug persistido mudar.

Medir o lifecycle real antes de escolher mecanismo em telas com estado caro ou tempo real.

## 8. Resolução e autorização

Registrar:

- ponto único em que URL vira identidade interna;
- comportamento de entrada malformada, inexistente e ambígua;
- limite e ordenação da busca de candidatos;
- resposta para recurso sem acesso;
- ordem entre resolução, carregamento e autorização;
- formato usado por mutações, relacionamentos, webhooks e subscriptions.

A URL pública nunca substitui a política de permissão.

## 9. Contrato entre backend e frontend

Definir o dono da forma canônica e onde ela aparece:

- list;
- get/detail;
- create;
- update;
- eventos e jobs;
- mocks, fixtures e objetos otimistas.

Separar URLs de navegação/compartilhamento de caminhos de API. Registrar quando fallback para a
identidade interna é permitido e quando é considerado regressão.

## 10. Rollout e observabilidade

Planejar:

- ordem de deploy entre backend e frontend;
- compatibilidade durante versões mistas;
- logs de parser inválido e ambiguidade;
- métricas de uso dos formatos legado e canônico;
- teste de links compartilhados fora da sessão atual;
- rollback sem invalidar URLs publicadas;
- gatilhos para rever comprimento, formato ou estratégia.

## 11. Registro da decisão

Usar este formato no plano:
### Decisão: <título>

- Contexto:
- Restrições medidas:
- Alternativa escolhida:
- Alternativas rejeitadas:
- Consequências aceitas:
- Compatibilidade necessária:
- Validação:
- Gatilho de revisão:
Encerrar a análise somente quando a implementação puder ser testada contra critérios objetivos,
sem depender de convenção implícita ou memória da equipe.
