# Apontamento Diário ITAM — entrega local de 04/11/2026

## Resultado e limites

Código implementado, compilado e validado localmente; pacote destinado à homologação. Nenhum banco de produção foi acessado ou alterado nesta missão. Não houve deploy, push, alteração de usuários, permissões, credenciais, URLs ou configuração dos provedores. Não se afirma que o ZIP original seja a versão publicada.

Referências obrigatórias: ZIP `Apontamento Diario.zip` fornecido pelo usuário (o PROMPT o chama de `Apontamento Diario(6).zip`), PROMPT MESTRE e RELATORIO_AUDITORIA_ITAM_2026-11-03. O arquivo autorizado pelo usuário prevalece sobre a divergência de nome. SHA-256 da origem: `bdfcb7183c1e465ef706176b344d27ca816803c159dd6bd69db2508dbceea093`.

O original já continha otimizações, staging idempotente, parser incremental, caches por sessão, GET sem overlay e testes. Esses recursos foram preservados; não são contabilizados como ganhos desta entrega. Os relatórios anteriores estão em `docs/historico`; `homologacao-local` contém evidências herdadas, e `homologacao-missao` contém os testes desta missão. O comparativo atual usa fixtures copiadas deste ZIP, não a fixture histórica `original-gestaoAtrasos.ts`.

## Matriz por melhoria

| Situação | Arquivos | Alteração e regra protegida | Medição antes → depois | Risco residual |
|---|---|---|---|---|
| IMPLEMENTADO; VALIDADO EM TESTE | server.gestaoAtrasos.ts | Total e KPIs agregados em uma passagem sobre o conjunto filtrado. Preserva canônica série/setor, desempate data/OP, período Manaus, status, contagem de transformadores e página de 50. | Cenário geral p95 1.474 → 1.044 ms; 1 consulta e 20.993 bytes de resposta em ambos. | PostgreSQL/WASM local; CPU praticamente estável; não garante ganho em todas as seletividades. |
| IMPLEMENTADO; VALIDADO EM TESTE | server.gestaoAtrasos.ts; src/pages/GestaoAtrasosPage.tsx | Nova API /filtros deriva combinações reais da base ativa, período e escopo autorizado. Setor/Linha clicáveis, incluindo Epóxi; dependência e limpeza de seleção incompatível. | Não recarrega opções ao digitar OP/cliente/série; debounce de 250 ms e descarte de resposta antiga. | Nova consulta ao abrir/atualizar/período; não se afirma redução global de queries da tela. |
| IMPLEMENTADO; VALIDADO EM TESTE | GestaoAtrasosPage.tsx; OpKpis.tsx; gestao-atrasos.css | Filtros, cartões e superfícies reutilizam Aderência Mensal. Importação recolhível, tabela com rolagem própria, foco/teclado e todas as colunas. | Screenshots 1440×1000 e 390×844; sem overflow horizontal da página mobile; foco na região da tabela. | Homologar dados e dispositivos reais; navegação completa não teve ganho uniforme. |
| IMPLEMENTADO; VALIDADO EM TESTE | server.gestaoAtrasos.ts; GestaoAtrasosPage.tsx | Modal recebe filtros opcionais Linha/Cliente/Série para a lista de séries. Sem parâmetros, contrato anterior. Progresso dos outros setores da OP visível continua somente leitura. | Paridade do detalhe sem novos filtros e teste do detalhe filtrado. | Extensão explícita de apresentação solicitada no PROMPT; não altera cálculos de progresso global da OP. |
| IMPLEMENTADO; VALIDADO EM TESTE | server.gestaoAtrasos.ts | Lote OP usa oito arrays tipados e UUID único via UNNEST; transação, locks, replay, conflito e PENDENTE→ATIVA preservados. | Programação/1.000: SQL 109.853 → 1.089 bytes; p50 226 → 152 ms; 4 chamadas em ambos. | HTTP inalterado; volume lógico gravado preservado; concorrência real depende de homologação. |
| IMPLEMENTADO; VALIDADO EM TESTE | server.ts | Limpeza de importados em conjuntos de até 400; inserção da produção em lotes de até 400. Preserva flags null/false/true, filhos manuais, IDs usados, setor/linha/turno e aprovação conforme comportamento original. | Limpeza: 635 → 6 consultas; importação/1.200 grupos: 1.866 → 43 consultas. | Schema sintético; triggers/grants reais não exercitados; fronteira transacional continua por dia. |
| IMPLEMENTADO; VALIDADO EM TESTE | server.ts | Filtro mensal TO_CHAR substituído por intervalo semiaberto indexável. Meses inválidos legados continuam sem correspondências. | Equivalência incluindo fevereiro bissexto, troca de ano e limites de dia/mês. | Benefício de índice em nuvem NÃO MEDIDO; nenhum índice criado. |
| IMPLEMENTADO; VALIDADO EM TESTE | src/productivity/services/dashboardService.ts | Converte cada página de 1.000 sem reter o array bruto completo; mantém histórico, ordenação, matrícula/colaborador_id, controles/desligados, conversões e horas extras. Cancelamento também quando transporte ignora sinal. | Igualdade completa com 2.001 linhas em três páginas; mesmas consultas/projeção. | RAM NÃO MEDIDO; tráfego não reduzido. SELECT * continua padrão até validar view remota. |
| IMPLEMENTADO; VALIDADO EM TESTE | src/productivity/services/importService.ts | Normalização dos cabeçalhos uma vez por linha, reutilizada nas buscas. RPC e substituição integral preservadas. | XLSX sintético/10.000: p50 1.082 → 436 ms; p95 1.980 → 1.249 ms; preview idêntico. | Escrita/RPC remota não foi medida; staging permanece proposta. |
| VALIDADO EM TESTE | testes e scripts adicionados | Equivalência SQL/importação, componentes, produtividade, visual e build. Correção do seletor de teste Motivo para aceitar marcador obrigatório. | Original: 229 aprovados/1 falha; entrega: 244 aprovados/41 arquivos. | A falha original era de seletor do teste, não uma regra de negócio corrigida. |
| PENDENTE DE HOMOLOGAÇÃO | checklist e benchmarks | Carga real mascarada, concorrência, cold starts, CPU/RAM/CU, I/O, egress, WAL e custo. | NÃO MEDIDO nos provedores. | Não há aprovação de custo nem autorização de publicação. |
| PROPOSTA NÃO EXECUTADA | PLANO_SQL_NAO_EXECUTAR.sql; PLANO_SEGURANCA_NAO_EXECUTADO.md | Ponte autenticada, privilégios mínimos, staging RPC, validação da projeção/view, TLS e segredo. | Sem DDL, grants, políticas, RPC ou índices novos executados. | Riscos preexistentes da auditoria permanecem. |

## Compatibilidade e escopo

Não se alteraram regras de negócio de atraso, conversões, horas extras, aprovação, permissões ou substituição das bases. Mudanças observáveis autorizadas: seletores dependentes dos dados; validação numérica antes da pesquisa; lista de séries do modal coerente com filtros; layout e tabela responsiva. Outros setores da OP continuam no progresso agregado somente leitura; não se filtra esse progresso como se fosse a lista de séries. Justificativas/histórico permanecem por OP e setor.

Não se modificaram código da Visão Série, importadores de Série/programação/aderência anual, cálculos das demais telas, autenticação, conexões, package-lock ou dependências. O batch de programação de 400 já existia e foi mantido; não há medição que justifique outro tamanho. Sem novos pools, polling, cron, retries ou prefetch geral. Cancelamento vale para leituras; importações não foram paralelizadas.

O mapa funcional anterior foi revisto contra código e complementado em MAPA_MISSAO.md e INVENTARIO_MISSAO.json. Isso é inventário estático, não alegação de teste ponta a ponta de todas as telas com dados reais. Testes automatizados cobrem os módulos disponíveis; funcionalidades intactas continuam requerendo roteiro operacional de homologação.

## Validação efetivamente executada

- npm ci nas duas cópias isoladas, sem .env; build final sem credenciais VITE. Node final 22.23.4, PGlite 0.5.13/PostgreSQL 18.6 WASM.
- npm run typecheck, npm run test (244), npm run build, npm run test:sql, npm run test:neon: aprovados.
- npm run test:audit-sql: 21 cenários de equivalência, filtros/permissões, detalhe, limites, replay, conflito, finalização incompleta/repetida, datas Manaus e planos locais.
- npm run test:imports: limpeza/inserção equivalentes, filhos manuais, complementos, associação, reimportação, merge de turno e rollback de dia sem desfazer dia anterior confirmado.
- npm run benchmark:productivity: XLSX de 10.000 linhas, preview idêntico; testes de serviço incluem 2.001 registros e arquivo de 1.500 linhas.
- Chrome com rede restrita ao loopback: referência Mensal, OP, Epóxi, teclado, mobile, modal e justificativa/histórico gravados somente no PGlite descartável. Evidências em evidencias/.

Instalação apontou 11 vulnerabilidades herdadas (2 moderadas, 4 altas, 5 críticas). Não foi executado npm audit fix nem upgrade amplo; tratar em trilha separada com teste de compatibilidade. Isto não representa nova auditoria de segurança completa.

## Ensaio adicional no navegador

Upload de XLSX sintético de 1.001 linhas para cada tipo OP passou pelo parser, dois lotes sequenciais e finalização reais do mock: programação e apontamento importaram 1.001 cada. Parser também leu 50.000 linhas válidas. Navegação compilada: p50 1.281 → 1.281 ms e p95 1.381 → 1.518 ms; não foi comprovado ganho global. Veja metodologia e limites no BENCHMARK_ANTES_DEPOIS.md.

## Pendências concretas

Não foram fornecidos ambiente de homologação autorizado nem XLSX reais mascarados; não houve captura da versão publicada, validação de configuração Vercel, esquema remoto da view, grants/triggers reais, latência WAN, carga concorrente, 200 mil registros ponta a ponta ou uso por turno. RAM, CU e custo real: NÃO MEDIDO; consumo igual ou menor: NÃO VALIDADO. Limites de quantidade e estado transacional foram testados localmente, o que não substitui esse aceite.

A versão não exige migração nova para compilar ou rodar os mocks. SQLs de instalação herdados são preservados para rastreabilidade e não devem ser executados automaticamente. Consulte CHECKLIST_HOMOLOGACAO.md antes de qualquer ativação real.
