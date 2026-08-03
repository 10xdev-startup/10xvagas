name: url-slug
description: |
  Executa migrações seguras de identificadores públicos em URLs sem misturar identidade,
  apresentação e autorização. Use quando um plano já definiu a política de slug e for preciso
  implementar parser, resolução, contratos de API, navegação, compartilhamento, compatibilidade
  com links antigos e testes; também use para diagnosticar regressões em rotas com slug.
---

# url-slug

Use esta skill como protocolo de execução. Não transforme decisões de um projeto anterior em
defaults universais.

## Publicação

**Card:** https://10xdev.com.br/card/0260bb22-f388-4ad5-a99f-ac934aa30c15  
**id:** `0260bb22-f388-4ad5-a99f-ac934aa30c15`

A fonte da verdade das lições é esta skill. O card publica o playbook e exemplos portáteis de
código. Exemplos ilustram o mecanismo; o plano do projeto continua sendo a autoridade sobre a
política adotada.

## Contrato com o plano

Antes de editar código, ler o plano da migração e usar as decisões já registradas nele, sem
reinterpretar. Se faltar alguma decisão, ler [`decisoes.md`](decisoes.md), conduzir a análise e
registrar o resultado no plano antes da implementação. Não transformar exemplos da referência em
defaults silenciosos.

## Invariantes universais

### Separar identidade, apresentação e autorização

- Tratar o texto amigável como apresentação, salvo quando o plano disser explicitamente que ele é
  a identidade persistida.
- Resolver a URL para a identidade interna antes de executar regras de domínio.
- Autorizar depois da resolução. Slug, UUID e qualquer identificador público não são credenciais.
- Manter APIs internas, filtros, relacionamentos e canais de eventos usando a identidade canônica.

### Validar toda a gramática antes do banco

- Rejeitar entrada malformada sem montar query parcialmente válida.
- Validar conteúdo, comprimento e fronteiras; validar apenas a janela final da string é insuficiente.
- Quando UUID cru também for aceito, reconhecê-lo antes de um parser de sufixo: um UUID canônico
  pode terminar com a mesma forma aceita pelo parser.
- Separar política de formatos aceitos da conversão para chave/range de banco.
- Traduzir entrada inválida ou inexistente para a resposta prevista no plano, sem vazar erro interno.

### Nunca escolher silenciosamente em ambiguidade

- Buscar candidatos suficientes para detectar colisão; `limit(1)` esconde o problema.
- Retornar somente quando o resultado satisfizer exatamente a política do plano.
- Registrar ambiguidade com informação operacional suficiente para investigação.
- Não usar ordenação determinística como solução: ela estabiliza o resultado errado.
- Revisar o shape da biblioteca ao trocar consulta singular por lista; helpers como `maybeSingle`
  deixam de servir quando mais de um candidato precisa ser observado.

### Resolver uma vez na borda

- Centralizar slug → identidade no primeiro ponto compartilhado da requisição.
- Fazer handlers e domínio receberem somente a identidade resolvida.
- Sobrescrever/sombrear o parâmetro original após resolver; manter duas variáveis parecidas favorece
  o uso acidental do slug numa query seguinte.
- Enumerar também mutações e vínculos. Uma igualdade `id = slug` pode retornar zero linhas sem erro.

### Ter uma única forma de construir URLs

- Criar um helper por recurso para navegação e compartilhamento.
- Não depender de `slug ?? id` repetido manualmente em cada componente.
- Tratar separadamente três classes:
  1. navegação da aplicação;
  2. URL copiada, enviada ou persistida fora da aplicação;
  3. caminho de API e identidade interna.
- Migrar as classes 1 e 2 conforme o plano. Não trocar automaticamente IDs corretos da classe 3.

### Materializar o contrato completo

- Incluir a forma canônica em todos os produtores do recurso: list, get, create, update e eventos.
- Procurar objetos otimistas e literais do frontend; eles também materializam o contrato.
- Fazer o backend devolver a forma canônica quando ele é o dono da política.
- Evitar gerar um segundo slug no frontend apenas para corrigir response incompleto.

### Tratar compatibilidade como rede, não caminho principal

- Fazer os links internos nascerem canônicos pelo helper.
- Manter o formato legado apenas para links externos, bookmarks e dados já publicados.
- Preservar pathname restante, query string, hash e aba quando canonicalizar.
- Medir o efeito do redirect em árvores caras ou com subscriptions. Remount isolado é custo;
  subscription antiga sobrevivendo ao cleanup é sinal de corrida.
- Evitar manipular `history` diretamente quando isso deixar os hooks do roteador incoerentes com a
  URL exibida.

## Fluxo de execução

### 1. Inventariar as superfícies

Buscar por:

- parâmetros dinâmicos de rota e resolvers existentes;
- `router.push`, `router.replace`, links e redirects;
- clipboard, share URL, e-mail, convite, notificação, cache e local storage;
- callbacks de autenticação e retorno de integrações;
- endpoints, queries, mutações, webhooks e channels/subscriptions;
- todos os responses e tipos que materializam o recurso.

Classificar cada ocorrência nas três classes de URL antes de alterar.

### 2. Implementar a peça pura

Implementar normalização, geração e parsing sem dependência de framework ou banco. Fixar em testes:

- entradas normais, vazias após normalização, unicode e tamanho máximo;
- round-trip da forma canônica;
- todos os formatos legados permitidos pelo plano;
- comprimentos imediatamente abaixo e acima dos válidos;
- conteúdo inválido com final aparentemente válido;
- não-confusão entre formatos aceitos.

Se usar remoção de acentos em JavaScript/TypeScript, escrever a faixa como
`\u0300-\u036f`, nunca com combining marks literais invisíveis.

### 3. Implementar o resolver

Aplicar as guardas na ordem:

1. identidade canônica já aceita;
2. parsing completo;
3. conversão para lookup;
4. busca que detecta ambiguidade;
5. aplicação exata da política definida no plano;
6. log + não encontrado quando não houver resolução segura.

Ao usar range sobre tipo nativo, comparar valores do mesmo tipo. Evitar cast da coluna indexada para
texto, que pode impedir o uso do índice. Validar essa recomendação no banco adotado pelo projeto.

### 4. Centralizar na borda

Instalar o resolver no middleware, loader, route binding ou mecanismo equivalente do framework.
Testá-lo isoladamente antes de conectar todos os handlers. Confirmar que autorização e 404 existentes
continuam com a mesma semântica.

### 5. Fechar o contrato de dados

Adicionar a forma canônica aos tipos e a cada materializador. Rodar typecheck cedo: ele costuma
revelar create responses, fixtures, mocks e objetos otimistas ausentes do inventário inicial.

### 6. Migrar URLs pelo helper

Substituir construções inline nas classes 1 e 2. Manter a identidade interna nas APIs, filtros e
subscriptions. Fazer uma busca final no repositório; o inventário inicial orienta, mas não prova
completude.

### 7. Canonicalizar formatos legados

Adicionar a rede de compatibilidade somente depois que as fontes internas estiverem fechadas. Medir
mount/unmount, fetches e subscribe/unsubscribe quando houver estado caro ou em tempo real. Remover a
instrumentação temporária após decidir.

### 8. Validar de ponta a ponta

Executar typecheck, lint e testes pertinentes. Depois cobrir:

- forma canônica abre o recurso correto;
- cada formato legado permitido converge para a forma canônica;
- entrada malformada não toca no banco quando puder ser rejeitada antes;
- colisão/ambiguidade nunca abre um registro arbitrário;
- rename segue exatamente a política do plano;
- query, hash e subrota sobrevivem à canonicalização;
- navegação e link compartilhado usam a forma pública;
- API, mutações e subscriptions usam a identidade interna;
- recurso sem acesso continua indistinguível de inexistente quando essa for a política;
- create/list/get/update devolvem contratos coerentes.

## Lições que se repetem

| Sintoma | Causa recorrente | Prevenção |
|---|---|---|
| Slug abre registros diferentes | Consulta esconde ambiguidade | Buscar mais de um candidato e nunca escolher silenciosamente |
| Query seguinte não encontra nada | Resolveu, mas continuou usando a variável original | Sobrescrever o parâmetro na borda |
| Delete/update não altera linhas | Mutação recebeu slug no campo de ID | Auditar todas as escritas e vínculos |
| URL volta ao ID ao navegar | Um call site reconstrói caminho manualmente | Helper único + busca final no repo |
| Link copiado permanece legado | Auditoria olhou apenas navegação | Tratar compartilhamento como classe própria |
| Entrada inválida vira erro do banco | Parser aceitou gramática parcial | Validar conteúdo, comprimento e fronteira antes da query |
| Frontend quebra após adicionar `slug` | Create/mock/objeto otimista ficou fora do contrato | Enumerar todos os materializadores e rodar typecheck cedo |
| Redirect cria fetch/subscription duplicada | Canonicalização remonta a árvore | Medir lifecycle e cleanup em runtime |
| Backend e frontend geram slugs diferentes | Implementações duplicadas sem contrato | Compartilhar módulo ou fixture de contrato |
| Regex funciona, mas degrada ao viajar entre ferramentas | Combining marks literais invisíveis | Usar escapes unicode explícitos |

## Guardrails para adaptações

- Não copiar comprimento, alfabeto, política de rename ou desempate de outro projeto.
- Não presumir distribuição aleatória do ID; verificar o gerador adotado antes de usar prefixos.
- Não persistir ou derivar slug por conveniência local; seguir o plano.
- Não duplicar parser no frontend: resolução pertence ao backend/borda confiável.
- Não prometer ausência de colisão sem constraint; tratar risco e comportamento conforme o plano.
- Não remover fallback de formato já publicado sem uma estratégia explícita de expiração.
- Não usar slug ou UUID como autorização.
- Não transformar exemplos de framework do card em arquitetura obrigatória.

## Critério de conclusão

Concluir somente quando:

- decisões permanecem no plano e a implementação corresponde a elas;
- parser e resolver têm testes de fronteira e ambiguidade;
- toda URL de navegação/compartilhamento passa pelo helper;
- APIs, escritas e estado interno usam a identidade canônica;
- todos os materializadores devolvem o contrato completo;
- compatibilidade legada e canonicalização foram verificadas em runtime;
- busca final não encontra construções concorrentes fora das exceções documentadas.
