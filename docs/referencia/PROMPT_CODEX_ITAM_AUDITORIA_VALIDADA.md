# MISSÃO CODEX — OTIMIZAÇÃO INTEGRAL VALIDADA EM NEON E SUPABASE

**Projeto-base:** `Apontamento Diario(4).zip` (código-fonte completo).  
**Diagnóstico técnico anexo:** `RELATORIO_AUDITORIA_BANCOS_ITAM_VALIDADA_2026-10-30.md`.  
**Natureza da tarefa:** IMPLEMENTAR otimizações no código, testar e entregar versão pronta para homologação; alterações em bancos de produção, políticas RLS, índices, schema ou deploy exigem autorização explícita e separada.

## OBJETIVO

Reduzir ao máximo o tempo de carregamento de todas as telas, filtros e importações do Apontamento Diário ITAM sem retirar, alterar ou degradar regras de negócio, acesso, autenticação, cálculos, histórico, apresentação de dados, conexões, integridade, exportações e reimportações. Reformular a interface de **Atraso > Visão por OP**, integrando cartões KPI, filtros confiáveis, lista de OPs e modal estruturado, preservando a Visão por Série. **Não aumentar o consumo de Neon/Supabase**: exigir evidências comparáveis (não apenas alegações). Não partir do zero; preservar o que já funciona.

## EVIDÊNCIAS CONFIRMADAS PARA GUIAR PRIORIZAÇÃO

- **Neon Apontamento:** projeto `quiet-dream-16310704`, `neondb`/branch `production`, PostgreSQL 18, 0,25–2 CU. Principais bases estimadas: `producao` 3.861, `programacao` 3.185, `apontamentos` 845. Muitas varreduras sequenciais acumuladas, mas bases pequenas; sem atribuição de latência histórica porque `pg_stat_statements` foi reiniciado em 30/10/2026 durante a auditoria. NÃO inventar conclusão de “Neon lento por falta de índices”. O código consulta sete conjuntos auxiliares ao carregar apontamentos e roda uma rotina reparadora de duplicidades a cada ~5 minutos por instância em alguns GETs.
- **Supabase Prod_individual:** projeto `bqqfrqmkemtfmracuyoi`, PostgreSQL 17. `atrasos_programacao_detalhada` ~53.462 registros (32 MB com índices); `atrasos_apontamentos_detalhados` ~52.797 (25 MB); importações ATIVAS para ambos os tipos. `controle_atrasos` ~2.158; `producao` ~2.051; `jornada_colaborador` ~1.397; `colaboradores_controle` ~53.
- **Query real Visão OP:** 23 chamadas; média **432,27 ms**, pico **2.749,9 ms**, total **9.942,2 ms** desde reset dos contadores de SQL em 28/08/2026. Plano `EXPLAIN` mostra `Seq Scan` ~53 mil, `Sort + Unique` de `DISTINCT ON (serie,setor)`, filtro temporal aplicado DEPOIS, `Nested Loop` com buscas por índice em apontamentos, agregação, `COUNT(*) OVER()`. A estimativa do planner para linhas ativas é ~85, inconsistente com a importação ativa ~53 mil. **Investigar junções, seletividade, estatísticas e plano antes de otimizar; NUNCA trocar sem teste de equivalência.**
- **Produtividade:** `vw_producao_detalhada` acumulou 654 leituras de uma assinatura (~29,95 ms SQL médios, 19.589,7 ms acumulados) e o frontend faz `select('*')` paginado de 1.000 de forma sequencial. Preservar regra de funcionário, matrícula, turno, horas e datas.
- **Visão Série:** 254 consultas totais da assinatura (29,13 ms SQL médios) e frontend baixa toda a base. Preservar todas as funções e exportações.
- **Supabase índices existentes:** as duas tabelas OP JÁ têm PK composta e índices por importação/data, importação/OP/setor e importação/série/setor; `atrasos_apon_serie_setor` registrou ~524.884 buscas. Não criar/descartar índice arbitrariamente. O advisor encontrou 5 índices sem uso, mas isso não prova redundância.
- **Validações de negócio:** `server.gestaoAtrasos.ts` usa janela fixa mês anterior + mês atual, mesmo quando a UI recebe datas diferentes; contagem por `COUNT(*) OVER()` falha em página vazia; frontend dispara GET após 250 ms sem cancelar/ignorar requisições antigas; modal sofre risco semelhante de mudança rápida de OP. API aceita 2 bilhões de registros esperados e CHECK do banco limita a 200 mil: alinhar contrato sem regressão.
- **Importações:** staging PENDENTE → ATIVA com confirmação de quantidade e exclusão da importação anterior apenas na finalização. Lotes sequenciais de 1.000 linhas; assinaturas de INSERT apresentaram médias SQL de ~13 a 35 ms, indicando que o overhead da rede/UX deve ser medido antes de paralelizar. Importação mensal Neon fragmenta por dia para evitar timeouts da Vercel. Preservar transações/idempotência e comportamento de erro.
- **Segurança à parte:** `excluir_registros_mes` e `importar_produtividade` no Supabase são `SECURITY DEFINER` e executáveis por `anon`; a primeira exclui dados e a segunda substitui produção e jornada. `vw_producao_detalhada` tem alerta security-definer; `colaboradores_controle` tem RLS sem policy, com 53 registros possivelmente invisíveis ao cliente publicável. NÃO modificar privilégios ou políticas em produção sem revisão/autorização; oferecer plano específico de mitigação sem interromper importação ou login.

## FASE A — CÓPIA, INVARIANTES E BASELINE

1. Criar branch/cópia íntegra do ZIP original e checksum; não modificar original nem incluir `.git`/secrets na entrega.
2. Mapear todas as abas, imports e endpoints: página → serviço → API → pool → SQL → tabela, com perfis e autorização. Registrar provas do comportamento atual em testes de caracterização.
3. Validar nomes de variáveis: `DATABASE_URL` (Neon); `ATRASO_DATABASE_URL` ou `SUPABASE_DATABASE_URL` (SQL Supabase Atrasos, fallback Neon); `VITE_SUPABASE_URL` (SDK produtividade). Não inferir valores de produção nem alterar conexão sem autorização.
4. Executar `npm ci`, `npm run typecheck`, `npm test`, `npm run build`; registrar falhas iniciais e corrigi-las sem regressão.
5. Instrumentar desempenho por tela e fluxo, sem logs de dados pessoais: navegação, primeiro carregamento, filtros, modal OP, dashboards, aprovação, série, produtividade, importação produção/programação/atrasos/OP/aderência. Coletar p50/p95 frontend/API/SQL, chamadas, payload, CPU, conexões e consumo de bancos em cargas equivalentes antes/depois.

## FASE B — PERFORMANCE GLOBAL

1. Remover o overlay global bloqueante de GET rotineiros (`src/services/apiClient.ts`) em favor de feedback local/skeletons. Operações críticas devem mostrar progresso e não esconder erros.
2. Cancelar/ignorar respostas GET obsoletas, manter estado estável e invalidação correta de cache; não cancelar silenciosamente mutations/importações.
3. Reduzir requisições e payloads desnecessários, cálculos/renderizações redundantes, importação e filtros feitos repetidas vezes no frontend. Avaliar memoização, lazy loading, virtualização e agregações conforme medições.
4. Otimizar endpoints da Coordenação e Dashboard Neon sem aumentar número total de queries. A rotina `repairAllTurnSectorDuplicates()` pode escrever em GET: preservá-la funcionalmente, mas projetar execução segura e desacoplada após testes. Não aumentar pooling/concorrência/intervalos de refresh por conveniência.
5. Aplicar paginação ou filtro no servidor quando comprovar benefício, mantendo exportação completa, acesso, totais e estados existentes.

## FASE C — QUERY DA VISÃO OP (PRIORIDADE MÁXIMA)

1. Perfilar a implementação em `server.gestaoAtrasos.ts:197-274` com SQL e cenário representativo em homologação. Capturar plano e estimativas, sem `EXPLAIN ANALYZE` em produção. Registrar efeito de `DISTINCT ON`, `JOIN` e condição de data antes de modificar.
2. Reduzir ordenações e leituras intermediárias e evitar `Nested Loop` caro quando possível, usando índices JÁ existentes e uma escolha canônica por série/setor exatamente equivalente. Somente considerar novos índices/estatísticas/DDL em plano de alteração **separado e sujeito à autorização**. Não materializar/cachar dados por usuário/OP indiscriminadamente.
3. Corrigir filtros combinados (OP, série, setor, linha, cliente, situação, justificativa, datas, várias datas) preservando escopo autorizado. Explicitar/corrigir a janela de datas; não induzir usuários a filtrar período não suportado.
4. Corrigir `total` de paginação quando página não retorna resultados e consistente nos cartões, páginas e filtros.
5. Preservar regra da série em múltiplos setores, série conflitante entre OPs, contagem produção programada versus realizada, datas, status de atraso, justificativa e prazo. Testes automatizados usando dataset característico de divergências.

## FASE D — NOVA EXPERIÊNCIA EM ATRASO > VISÃO POR OP

- Tela Atraso existente deve conter seletor **Visão por Série / Visão por OP**, sem destruir a Visão Série nem criar fluxo redundante.
- Cartões: OPs atrasadas, transformadores vencidos, produzidos fora do prazo, sem justificativa, prazo vencido e regularizados; KPIs devem manter filtro e autorização coerentes. Não disparar consulta pesada adicional para cada cartão; reutilizar resumo ou endpoint otimizado.
- Filtros claros, rápidos, com reset, estado vazio, debounce/cancelamento de GETs; jamais permitir resposta antiga sobrescrever filtro atual.
- Lista/cartões por OP/setor: OP, cliente, linha, potência, datas, quantidade programada/produzida, pendências, % realizado, situação e previsão.
- Modal por OP: resumo executivo, progresso agregado de todos os setores, séries e datas apenas do setor autorizado, histórico, justificativa e prazo, estados locais de carregamento/erro. Coordenação vê dados gerais; líderes veem somente seus setores em detalhes e podem justificar apenas seu setor, mantendo progresso agregado dos demais.
- Responsividade, acessibilidade, identidade visual coesa, contraste e legibilidade.

## FASE E — TODAS AS IMPORTAÇÕES, SEM AUMENTO DE CONSUMO

- Medir em separado XLSX parse, transformação, validações, payload JSON, tempo HTTP, tempo SQL, fechamento de importação, conferência de divergências e atualização da UI; mostrar progresso real.
- Não substituir importação mensal por chamada gigante sujeita a timeout. Não ativar concorrência ilimitada. Lotes devem ser idempotentes e reprocessáveis com segurança, mantendo PENDENTE/ATIVA e tolerância a falha.
- Tratar limite de 5 MB JSON e diferenças de limite de quantidade da API/DB. Preservar colunas, normalizações, setores, turnos, exportações e lógica das reimportações.
- Produtividade Supabase: rever view/dados, RLS e tamanho de payload, mantendo cálculos. **Segurança das RPCs exige remediação separada**.

## FASE F — VERIFICAÇÃO OBRIGATÓRIA

1. Comparar resultados de SQL original/novo em amostras e totais do período, por OP/setor/série; testar perfis, campo de justificativa, prazo, importação interrompida/repetida, séries conflitantes, mês anterior/atual e novos períodos, página vazia.
2. Rodar testes e build; adicionar testes de desempenho/requisições e regressão de integrações. Fazer validação manual em homologação com datasets representativos mascarados.
3. Registrar ANTES/DEPOIS por etapa: p50/p95 carregamento, filtro, importação, calls SQL, total_exec_time, payload, CPU e compute/CU, conexões e volume de escrita. Se métricas ausentes, marcar “não validado” e bloquear declaração de aprovação do consumo.
4. Nenhuma alteração em banco real/deploy sem consentimento. Entregar ZIP atualizado pronto para homologação, diff/changelog, relatório de testes, SQLs propostos **não executados**, plano de rollback e pendências.
5. Priorizar correção de comportamento e filtros > query Visão OP > importações > telas gerais > polimento. Não trocar aparência por desempenho fingido nem sacrificar regras existentes.

**Entregar implementação real e relatório completo, não somente análise. Não afirmar “consumo igual ou menor” sem medição comparativa.**
