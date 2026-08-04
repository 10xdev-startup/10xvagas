# Correções pós-review — análise de perfil e catálogo de vagas

## Objetivo

Fechar os nove riscos encontrados no review da branch de análise de currículo sem ampliar a arquitetura: preservar Node como dono do produto, Python como engine e PostgreSQL como fronteira assíncrona.

## Decisões

1. **Perfil aprovável é perfil executável.** `matching_facts` passa a ter schema explícito para todos os campos consumidos pelo matcher, e o backend repete a validação de domínio antes de aprovar.
2. **Respostas humanas alteram o fato de destino.** A UI aplica respostas apenas em caminhos canônicos suportados e tipados; não cria mais `human_answers` ignorado pelo restante do sistema. Campos não suportados continuam pendentes e exigem edição avançada.
3. **Somente intenção evidenciada pontua.** `secondary_or_limited_evidence` permanece no perfil para diagnóstico, mas não entra em cobertura positiva do matching.
4. **Modelo presencial canônico é `onsite`.** O normalizador e o matcher aceitam esse valor e exigem uma localidade declarada, assim como no híbrido.
5. **Vaga tem ciclo de vida explícito.** Cada coleta bem-sucedida reativa as vagas vistas e encerra apenas as vagas ausentes daquela fonte. Falha de fonte nunca encerra seus registros. A tabela recebe `is_active` e `closed_at`.
6. **Listagem é leve e limitada.** `GET /jobs` recebe `offset` e `limit`, devolve paginação, não carrega descrição completa e só lista vagas ativas. O detalhe mantém a descrição.
7. **Retry de settlement respeita lease.** Falha transitória mantém o evento em `processing`; ele só volta a ser reclamável quando o lease do RPC expira, evitando consumir todas as tentativas no mesmo drain.
8. **Customer Stripe é idempotente por usuário/produto.** A criação usa chave determinística no namespace `10xvagas`; corridas retornam o mesmo Customer.
9. **Tokens cached não são somados duas vezes.** `total_tokens` representa `input_tokens + output_tokens`; cached continua como decomposição do input.

## Banco

- Alterar `job` com `is_active boolean not null default true` e `closed_at timestamptz null`.
- Criar índice parcial para listagem de vagas ativas por `last_seen_at`.
- Nenhum arquivo SQL será versionado; o patch será entregue/aplicado pelo canal Supabase permitido.

## Verificação

- Testes direcionados de matcher/live matching, coleta, worker de análise e billing.
- Testes direcionados de Models/Controllers afetados.
- Testes do helper de respostas pendentes e serviço/listagem do frontend.
- `typecheck` e `lint` dos workspaces, sem executar suítes Jest completas sem filtro.

## Checklist

- [x] Schema e aprovação impedem `matching_facts` incompleto.
- [x] Respostas pendentes atualizam o Perfil Canônico.
- [x] Secundárias não pontuam e presencial funciona em local aceito.
- [x] Coletor encerra ausentes por fonte e preserva fontes com falha.
- [x] Aplicar `is_active`/`closed_at` e índice parcial no Supabase.
- [x] Listagem é paginada, ativa e sem descrições completas.
- [x] Retry Stripe respeita backoff por lease.
- [x] Customer e meter settlement continuam idempotentes.
- [x] Total de tokens não duplica cached.
- [x] Testes, typecheck e lint pertinentes passam.
