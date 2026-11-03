# Auditoria técnica integrada — Apontamento Diário ITAM

**Data da coleta:** 30/10/2026 (horários das ferramentas em UTC)  
**Base do código:** `Apontamento Diario(4).zip`  
**Escopo autorizado:** inspeção de código e consultas EXCLUSIVAMENTE DE LEITURA nos projetos Neon `Apontamento` e Supabase `Prod_individual`.

## 1. Resultado executivo

Foi confirmada uma fonte material de latência no Supabase: a consulta de **Atraso > Visão por OP** teve **23 execuções, 432,27 ms médios, 2.749,9 ms no máximo e 9.942,2 ms acumulados** no período coletado pelo `pg_stat_statements` (desde 28/08/2026). O plano `EXPLAIN` sem `ANALYZE` evidencia **varredura sequencial de `atrasos_programacao_detalhada` (53.462 linhas estimadas), ordenação/`DISTINCT ON` antes de parte dos filtros, e buscas por índice em `atrasos_apontamentos_detalhados` por série/setor**. O planejador estima apenas **85 linhas após o join com importação ativa**, estimativa a verificar com `EXPLAIN ANALYZE` exclusivamente em homologação, pois difere da cardinalidade real da importação ativa. O resultado pode explicar a latência de filtros, juntamente com as condições de corrida e overlay global no frontend.

A **Produtividade Individual** faz carregamento sequencial de todas as páginas de `vw_producao_detalhada`; o Supabase registrou **654 consultas** a essa view (média **29,95 ms** no banco, total acumulado **19.589,7 ms**). A origem exata das 654 chamadas pode incluir outras sessões/códigos; não atribuir todas a um usuário ou carregamento. A consulta da Visão Série (`controle_atrasos`) registrou **254 chamadas, 29,13 ms médios**, retornando **613.685 linhas cumulativas** nos registros do `pg_stat_statements` (métrica `rows`, não total de linhas distintas); o frontend recebe a base inteira a cada requisição.

No **Neon**, foram observadas muitas varreduras sequenciais acumuladas em tabelas pequenas, mas **não é possível atribuí-las a endpoints nem rotulá-las como a causa da lentidão**. As estatísticas `pg_stat_statements` do Neon foram reiniciadas em **30/10/2026 às 15:39:35 UTC**, durante a janela da auditoria, e só mostram as próprias consultas de diagnóstico; logo, não são uma base histórica válida de consultas lentas. **Não se deve alegar que o Neon está isento de problemas.**

**Também foram encontradas questões de segurança independentes de performance**, especialmente as RPCs de importação/exclusão no Supabase com permissão `EXECUTE` para `anon` e `SECURITY DEFINER`. Nada foi alterado.

## 2. Projetos e destinos verificados

| Provedor | Projeto | ID | Banco/branch | Observação |
|---|---|---|---|---|
| Neon | `Apontamento` | `quiet-dream-16310704` | `neondb`, `production`, `br-winter-unit-ac6kewhr` | PostgreSQL 18; aplicação principal |
| Supabase | `Prod_individual` | `bqqfrqmkemtfmracuyoi` | `public`, PostgreSQL 17 | Tabelas de produtividade, controle de atrasos e Gestão por OP |

O ZIP aponta: `DATABASE_URL` → banco principal; `ATRASO_DATABASE_URL` ou `SUPABASE_DATABASE_URL` → backend Atrasos, com fallback para `DATABASE_URL`; `VITE_SUPABASE_URL` → SDK da Produtividade Individual no navegador. A existência dos esquemas nos projetos é **compatível** com esse roteamento, mas a correspondência das variáveis **efetivamente configuradas na Vercel** não foi inspecionada: confirmar apenas nomes/destinos mascarados antes de publicar.

### Neon — configuração e volume

- Autoscaling configurado para **0,25 a 2 CU**; `suspend_timeout_seconds=0` indica **timeout padrão**, e não que o banco fica sempre ligado (ver documentação de Scale to Zero do Neon).
- Na data da coleta, o projeto informou `compute_time_seconds=95423`, `active_time_seconds=310424`, `data_transfer_bytes=308431872` no período iniciado em 01/10/2026; são **contadores de projeto**, não comparação antes/depois nem taxa CU isolada.
- Tabelas principais (estimativas `pg_stat_user_tables`): `producao` **3.861**, `programacao` **3.185**, `apontamentos` **845**, `faltas` **432**, `observacoes` **297**.
- `pg_stat_activity` no instante consultado: **1 sessão ativa (a auditoria) + 1 ociosa**. Não significa pico histórico nem limite de pool.
- Acumulados de scans: `apontamentos` **44.591** sequenciais / **113.529** indexados; `faltas` **42.159** sequenciais; `observacoes` **39.591** sequenciais; `producao` **14.238** sequenciais / **53.657** indexados; `programacao` **1.926** sequenciais / **189** indexados. Tabelas pequenas podem justificar seq scans; **não criar índices automaticamente**.
- Existem índices de data/identificação e combinação. Dois índices de aprovação em `apontamentos` têm zero scans contabilizados, mas podem suportar caminhos raros e não foram sugeridos para remoção.
- Não foi encontrado indicativo, nessa amostra, de necessidade imediata de aumentar CU, pooling ou conexões.

### Supabase — estrutura/volume ativo

| Tabela | Linhas estimadas | Tamanho com índices | Observação |
|---|---:|---:|---|
| `atrasos_programacao_detalhada` | 53.462 | 32 MB | programação por série/setor/OP |
| `atrasos_apontamentos_detalhados` | 52.797 | 25 MB | produção por série/setor/OP |
| `controle_atrasos` | 2.158 | 1,98 MB | Visão Série; sem chave primária |
| `producao` | 2.051 | 1,32 MB | Produtividade Individual |
| `jornada_colaborador` | 1.397 | 728 kB | horas extras/jornada |
| `colaboradores_controle` | 53 | 48 kB | RLS sem política |
| `atrasos_importacoes` | 2 | 64 kB | PROGRAMACAO e APONTAMENTO, ambas ATIVA |
| `atrasos_justificativas` | 0 | 24 kB | ainda sem histórico registrado |

`atrasos_importacoes`: **APONTAMENTO** 52.797 registros esperados, atualizado em 30/10/2026 14:17:50 UTC; **PROGRAMACAO** 53.462, atualizado em 14:19:51 UTC. A contagem vem da sessão de importação, não de leitura integral das tabelas.

Índices relevantes existentes: `atrasos_prog_data(importacao_id,data_programada)`, `atrasos_prog_op_setor(importacao_id,op,setor)`, `atrasos_apon_serie_setor(importacao_id,serie,setor)`, `atrasos_apon_op_setor(importacao_id,op,setor)`; há PKs compostas de `(importacao_id,serie,setor,op)` e índices de histórico de justificativas. **Não presumir falta de índices.**

O índice `atrasos_apon_serie_setor` teve **524.884 index scans** acumulados e `atrasos_importacoes_ativa_tipo` **532.506**; isso é compatível com junções repetidas, mas não identifica sozinho a origem de cada acesso. `atrasos_prog_serie_setor` e `atrasos_apon_op_setor` registraram zero index scans no snapshot. Não excluir índices sem justificar por cenários de consulta/importação.

## 3. Estatísticas SQL reais do Supabase (`pg_stat_statements`)

**Janela de acumulação:** desde **28/08/2026 16:45:45 UTC**; não corresponde às últimas 24 horas ou somente ao tráfego de hoje.

| Query/fluxo reconhecido | Calls | Média no banco | Máx. | Soma no banco |
|---|---:|---:|---:|---:|
| Visão OP — resumo com `DISTINCT ON` e `GROUP BY` | 23 | **432,27 ms** | **2.749,9 ms** | 9.942,2 ms |
| Produtividade — view `vw_producao_detalhada` paginada (assinatura principal) | 654 | **29,95 ms** | 128,0 ms | 19.589,7 ms |
| Visão Série — SELECT `controle_atrasos` | 254 | **29,13 ms** | 153,7 ms | 7.400,0 ms |
| Consulta adicional de programação/apontamento detalhados | 6 | **505,69 ms** | 1.119,0 ms | 3.034,1 ms |
| Gestão OP — outro padrão com `DISTINCT ON` | 8 | **173,15 ms** | 218,8 ms | 1.385,2 ms |
| Gestão OP — conferência de divergências pós-importação | 4 | **247,58 ms** | 385,0 ms | 990,3 ms |
| Visão Série — INSERT em lote (assinatura principal) | 199 | **30,36 ms** | 80,6 ms | 6.042,4 ms |
| Importação programação detalhada (uma assinatura de lote) | 53 | **34,80 ms** | 47,2 ms | 1.844,6 ms |
| Importação apontamento detalhado (uma assinatura de lote) | 52 | **30,69 ms** | 57,0 ms | 1.595,7 ms |

São **tempos SQL medidos pelo banco**, excluindo rede, React, parsing XLSX, fila de conexão, cold starts e transferência de payload. No caso de assinatura de INSERT, outras variantes de tamanho de lote aparecem nas estatísticas: não concluir que só existam 53/52 chamadas totais de importação.

**Plano `EXPLAIN` sem execução:** o SQL equivalente ao resumo identifica `Seq Scan` de `atrasos_programacao_detalhada` (estimativa 53.462 linhas), `Sort → Unique` por `(serie,setor,data_programada,op)`, filtro de período no `Subquery Scan` acima do `Unique`, `Nested Loop Left Join` e `Index Scan` em `atrasos_apon_serie_setor`, agregação por OP/setor e `WindowAgg` para total. A estimativa no `Hash Join` é de 85 linhas após filtrar importação ativa; isso contrasta com a sessão ativa contendo 53.462 registros e justifica investigação de estimativas/planos de junção, não prova uma correção única ou necessidade de `ANALYZE` manual em produção.

## 4. Achados cruzados com o ZIP — prioridades do Codex

**P0 / CRÍTICO — consulta da Visão OP.** `server.gestaoAtrasos.ts:197-274`: `DISTINCT ON` e janela temporal posterior à deduplicação; `done` com junção por série/setor/OP, `GROUP BY`, `LEFT JOIN LATERAL` justificativa e `COUNT(*) OVER()`. Reescrever/otimizar por medições, evitando `N×` buscas, preservando exatamente a escolha canônica de série/setor e o resultado dos filtros. Testar com séries repetidas em OPs/setores, linha e período. O `COUNT(*) OVER()` não informa total quando a página está vazia; corrigir o contrato da paginação. **Mudança de SQL requer teste de equivalência de resultados.**

**P0 / CRÍTICO — UX de filtros com resultado obsoleto.** `src/pages/GestaoAtrasosPage.tsx:39-59`: requisições disparadas por debounce de 250 ms, sem cancelamento de GET obsoletos; respostas podem chegar fora de ordem. O filtro por data é restringido pelo intervalo fixo do mês anterior + atual (`server.gestaoAtrasos.ts:231-238`), inclusive se o usuário escolher outro período. Corrigir sem ampliar consultas indiscriminadamente. Modal abre GETs em paralelo sem proteger troca rápida de OP.

**P0 / ALTO — tela bloqueada por GET/POST.** `src/services/apiClient.ts:84-121` ativa progress overlay global em toda requisição. Cada lote de importação produz nova interação de overlay. Substituir por feedback local e operação crítica controlada, sem perder visibilidade de erro/progresso.

**P0 / ALTO — gestão de importações.** `src/pages/GestaoAtrasosPage.tsx:69-89` envia lotes sequenciais de até 1.000; o SQL por lote no Supabase é relativamente rápido em média (~13–35 ms nas assinaturas dominantes), logo **medir primeiro latência HTTP por lote, tempo de XLSX e overhead de confirmação** antes de aumentar a concorrência. `server.gestaoAtrasos.ts:86-151` mantém staging PENDENTE/ATIVA e exclusão transacional — preservar. A confirmação por `COUNT(*)` e conferência de divergências custam consultas adicionais. Divergência de limite: API aceita `esperado<=2.000.000.000`, enquanto a tabela do Supabase impõe `esperado<=200.000`; alinhar validação sem mudar regras unilateralmente.

**P0 / ALTO — produtividade.** `src/productivity/services/dashboardService.ts:19-40` obtém `select('*')`, ordena por data, pagina sequencialmente, transfere a view completa para o navegador. A view `vw_producao_detalhada` é `producao LEFT JOIN jornada_colaborador ON (matricula,data)` e o índice único `(matricula,data)` existe. Acelerar fluxo usando projeções, filtros/consultas agregadas ou cache apropriado, sem modificar cálculo por colaborador/data/desligamento; avaliar paginação estável e duplicidades.

**P1 — dashboard/coordenação no Neon.** `server.ts:2242-2305` executa várias consultas em paralelo; `server.ts:2677-2692` devolve apontamentos completos, `server.ts:995-1070` carrega sete blocos auxiliares de dados, e `server.ts:952-986` verifica duplicidades e **pode consolidar registros por mutação como efeito de abrir páginas** (protegido por intervalo de 5 minutos por instância). Refatorar só após caracterizar regras de fusão, com monitoramento e sem eliminar função reparadora. O projeto cria `Pool` principal e opcional Pool de atrasos, sem limites explícitos: validar total de instâncias/conexões serverless antes de configurar limites.

**P1 — Visão Série.** `src/atraso/services/atrasoService.ts` e rota `server.ts:3082-3090`: retorna toda a base de `controle_atrasos` e o navegador filtra. A base atual estimada é de 2.158 linhas; otimizar por invalidação correta e transferência; paginar/filtrar no backend se houver benefício medido e preservar exportações/contagens.

**P1 — modal e layout.** Subdividir `GestaoAtrasosPage.tsx` em cards KPI, filtros funcionais e combináveis, lista com progresso, modal com abas resumo/setores/séries/histórico/justificativa; coordenadores enxergam tudo, líderes só seu setor para dados sensíveis e justificativas, mas podem visualizar **progresso agregado** de outros setores. Manter Visão por Série e não criar outra aba desconectada.

**P2 — redundância SQL e manutenção.** Os índices do Supabase são numerosos para o volume atual, mas muitos sustentam importações/PKs. Supabase advisor sinaliza 5 índices sem uso; análise de remoção somente em homologação com planos de consulta e comprovação. `controle_atrasos` sem PK foi confirmado; prever identificador estável se justificado, sem mudar contrato/importações de uma vez.

## 5. Segurança e acesso — atenção separada da otimização

1. **Risco elevado confirmado pelo catálogo de privilégios**: `public.excluir_registros_mes` e `public.importar_produtividade` usam `SECURITY DEFINER` e o papel **`anon` pode executar**. Inspeção somente leitura do corpo mostrou que a primeira exclui `producao` e `jornada_colaborador` por datas; a segunda exclui e recarrega essas tabelas. Há também `public.rls_auto_enable` com `anon EXECUTE` (função de event trigger; invocabilidade efetiva pela API precisa ser verificada). Requer revisão de autorização e segregação por backend. Não revogar sem construir fluxo alternativo e testar, nem publicar token privilegiado no navegador.
2. `vw_producao_detalhada` possui `reloptions=null`, e o Supabase advisor a classifica como **security definer view**; verificar visibilidade real sob papel anon e se é apropriado `security_invoker=true` após criar políticas adequadas. Trocar sem preparar RLS pode quebrar dashboard.
3. `colaboradores_controle` tem RLS habilitado, sem política, apesar de possuir SELECT concedido a `anon/authenticated`; para o cliente Supabase com chave publicável, o RLS tende a impedir visibilidade dos 53 registros. `src/productivity/services/dashboardService.ts` chama `.from('colaboradores_controle').select(...)`; isso pode explicar cadastro/controle vazio ou divergente. Validar em sessão representativa antes de qualquer mudança de RLS.
4. Tabelas da Gestão OP (`atrasos_programacao_detalhada`, `atrasos_apontamentos_detalhados`, `atrasos_importacoes`) têm RLS ativo e **sem SELECT concedido** a `anon`/`authenticated`; tal configuração é coerente com o acesso via backend SQL e não significa erro por si só.
5. `server.ts:12` tem fallback inseguro para `SESSION_SECRET`; `server.ts:15,25` aceita TLS `rejectUnauthorized:false`. Remediar apenas com plano de migração/testes para não quebrar conexões/usuários.

**Supabase advisors oficiais:** [primary key ausente](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key), [índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), [view security definer](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view), [função definer executável por anônimo](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## 6. Protocolo para o Codex, sem aumentar consumo

1. **Medir por cenário**, com arquivo de importação padronizado e filtros repetíveis: tempo p50/p95 browser, tempo API, SQL, chamadas, linhas/bytes, CPU e conexões; amostra fria e quente; tudo sob a mesma carga/intervalo. Separar latência de rede/cold starts de tempo SQL.
2. **Primeiro consertar sem aumentar leituras:** respostas tardias de filtros, overlay, renderizações e memoização. Depois atacar a consulta SQL da Visão OP por plano e equivalência, sem novos polls, triggers, materializações ou consultas extras a cada filtro.
3. **Importações:** cronometrar parse XLSX, validação, upload de cada lote, gravação, finalize, consulta divergências e atualização de interface. Limitar concorrência ao fluxo atual inicialmente; se modificar, estabelecer teto por instância, retry idempotente e medir CU/latência.
4. **Reescrever o resumo** de forma a reduzir ordenação prévia, nested-loop repetitivo ou materialização quando seguro. Verificar seletividade real e contexto de `DISTINCT ON` entre OPs; não antecipar filtro que mude qual OP vence ou a quantidade correta. Testar `EXPLAIN (FORMAT TEXT)` em produção se necessário, mas `EXPLAIN ANALYZE` apenas em homologação autorizada e preparada para carga.
5. **Usar os índices já existentes** antes de propor outros; não instalar extensões nem ampliar CU/pool sem medição. Considerar que `ILIKE '%cliente%'` não se beneficia de B-tree simples; qualquer extensão/índice adicional exige aprovação separada.
6. **Homologação obrigatória** com importações, alinhamento das variáveis reais de ambiente, perfis, justificação, erro em lote, reimportação, filtros mistos, exportações e regressão de cálculos de produtividade.
7. Segurança de RPC/RLS é trabalho de correção separado e de alta prioridade, não acessório de performance. Preparar proposta e autorização antes de aplicar schema/GRANT/revogações.

## 7. Limites da auditoria

- Concluídos: identificação de projeto e branch, estrutura e índices, estatísticas SQL históricas do Supabase, plano `EXPLAIN` não executado, perfis RLS/grants, anomalias verificáveis no código e contadores de uso do Neon.
- **Não executados:** `EXPLAIN ANALYZE` em produção, benchmarking HTTP real, instrumentação de navegador, benchmark de importação real, mudanças SQL, `VACUUM/ANALYZE`, atualização de índices/policies, testes com dados de produção gravados, deploy, medições de custo antes/depois; nem verificação do ambiente efetivo na Vercel.
- **Medição da meta “sem aumentar consumo”: não concluída**, pois não houve nova versão implementada nem experimento comparativo sob carga equivalente. O objetivo é uma restrição de aceite futura, não um resultado já demonstrado.
- **Todos os acessos de banco usados na auditoria foram somente leitura. Nenhuma tabela, índice, registro, permissão ou configuração de produção foi alterada.**
