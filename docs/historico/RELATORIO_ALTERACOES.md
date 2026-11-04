# ITAM — relatório de implementação e validação



Entrega: 03/11/2026. Origem: ITAM_SISTEMA_ORIGINAL.zip e auditoria técnica fornecida de 30/10/2026. As instruções do arquivo de missão foram aplicadas dentro da autorização expressa do usuário: implementação e testes locais; nenhuma publicação ou alteração de banco de produção.



**Resultado:** código otimizado e validado localmente, pronto para homologação. **Consumo Neon/Supabase: NÃO VALIDADO; aprovação de consumo bloqueada.** A entrega não declara equivalência de CU, CPU do provedor ou tráfego real. A missão integral inclui medições que dependem de homologação com contrato e carga representativos; essas pendências estão discriminadas abaixo, sem tratá-las como concluídas.



## Alterações entregues



1. **Leituras e UX:** GET/HEAD comuns deixam de acionar overlay global. Carregamento e erro locais permanecem; mutações mantêm progresso. Requisições antigas da OP/modal são canceladas/ignoradas, e as telas gerais alteradas usam proteção por versão de leitura. GETs iguais simultâneos podem ser coalescidos. HTTP 401 tardio não encerra uma sessão nova. Limite de JSON 5 MB validado antes da rede.

2. **Resumo OP:** uma consulta SQL compartilha conjunto filtrado, paginação, total, seis KPIs e status das importações. O total permanece correto em página vazia. A escolha canônica foi preservada e filtros de período personalizados passaram a valer inclusive no modal e justificativa. O default continua mês anterior + atual no fuso Manaus. Pré-filtros só são antecipados quando não alteram a escolha canônica.

3. **Plano SQL:** agregação de produção materializada apenas no cenário amplo; cenários seletivos preservam oportunidade de busca seletiva. As séries vencidas são agregadas junto ao resumo para evitar cruzamento caro adicional nos KPIs. Detalhe da OP reúne visibilidade, séries e agregado em uma consulta; histórico permanece separado.

4. **Interface OP:** seletor integrado à Visão Série, cartões, filtros/reset, datas explícitas, dados OP/setor e progresso. Modal dividido em resumo, setores, séries/datas, justificativa e histórico, usando o componente acessível existente. Não foi removida a Visão Série.

5. **Importações OP:** limite alinhado a 200.000; lotes sequenciais de 1.000, validação de duplicatas e replay idempotente. Uma repetição idêntica não regrava linhas; conflito de conteúdo reverte o lote inteiro. Finalização repetida reconhece importação ATIVA. Quantidade incompleta não substitui a base ativa. Parsing aceita o período informado e continua com período padrão quando não há seleção.

6. **Neon:** sete conjuntos auxiliares ordenados foram reunidos em uma ida SQL; com a leitura principal, 8 → 2 chamadas nesse caminho. O conteúdo mantém IDs bigint como texto, escala da potência, turnos e horários. Isso reduz viagens de rede, não prova redução de CPU. A fusão de duplicidades saiu dos GETs para manutenção explícita autenticada, transacional e sem scheduler.

7. **Cache e cálculos:** invalidação por geração e sessão evita repovoamento obsoleto. Agregações de Epóxi reaproveitam Map e máximo calculado, preservando fórmulas. Sem novos polls, aumento de pool, consultas por cartão ou concorrência ilimitada.

8. **Produtividade:** cancelamento de leituras e ordem estável data/ID, sem cortar histórico. Projeção de 18 campos implementada **por opt-in**, desligada por padrão: o ZIP não define a view e a coluna alternativa colaborador_id precisa ser preservada. Confirmar todas as colunas e equivalência em homologação antes de ativar. Sem retry automático com SELECT extra.

9. **Diagnóstico e execução:** medições opcionais frontend/API/SQL sem payloads pessoais; scripts SQL locais reproduzíveis; npm start funciona também no Windows. Criada API local de demonstração sem conexão externa. Não houve atualização ampla das bibliotecas de produção.



## Testes e evidências



| Etapa | Original | Entrega |

|---|---|---|

| npm ci | aprovado; Node 24 do host gerou aviso de engines | instalação concluída; lock inclui PGlite de teste |

| Typecheck | aprovado | aprovado em Node 22 |

| Vitest | 213 testes: 209 passaram, 4 falharam | 230 testes aprovados |

| Build | aprovado | aprovado |

| SQL OP em PostgreSQL local | baseline preservado em fixture | 16 cenários de equivalência + verificações adicionais aprovados |

| SQL dos filhos Neon | sete leituras originais preservadas | equivalência das sete coleções e casos bigint/decimal/nulos/turnos aprovada |



As quatro falhas iniciais eram de testes/fixtures: ausência de scrollIntoView no jsdom; uso incompatível de matcher de valor; fixtures sem turno que eram filtradas corretamente; texto ambíguo/rótulo desatualizado no teste Epóxi. Foram corrigidos os testes e o setup, sem alterar regras de produção para fazê-los passar. A comparação temporal da suíte não é benchmark, pois as execuções ocorreram em momentos/hosts de carga diferentes. Os testes novos exercitam resposta fora de ordem, modal/fechamento/salvamento, cache por sessão, limite 5 MB, coalescência, manutenção explícita/autorização/rollback e contrato de produtividade.



O script SQL usa **53.467 linhas sintéticas de programação** (53.462 + cinco bordas), aproximadamente 40 mil apontamentos sintéticos, conflitos de OP, série em mais de um setor, desempate, períodos julho/setembro/outubro/novembro e histórico de justificativas. Não é clone da produção, nem reproduz exatamente as 52.797 linhas reais da auditoria. O campo esperado de importação da fixture é de referência, sem pretender ser sua contagem física. Confere página vazia, perfis, detalhe, staging interrompido, replay, conflito e limites.



No navegador local foram conferidos o seletor Série/OP, lista/KPIs filtrados por OP e modal com agregado dos setores e séries/datas do setor escolhido. `visao-op-local.jpg` registra a tela com dados sintéticos. O formulário foi inspecionado; a gravação completa é coberta por teste de componente/API, não foi confirmada manualmente no navegador. Não houve homologação manual completa de todas as telas, responsividade/dispositivos, exportações reais ou importações reais de 200 mil linhas.



## Benchmark reproduzível local



PGlite/PostgreSQL WASM em memória; 12 amostras após aquecimento por implementação/cenário, ordem original → otimizado. Datas de referência fixas em 30/10/2026. p95 é o máximo das 12 amostras; amostra pequena. Tempos são do handler local (incluem ponte WASM), não latência de produção. CPU é consumo acumulado do processo nas 12 amostras, não CPU isolada do banco. Carga do computador, caches e agendamento do host limitam a comparação. Planos EXPLAIN ANALYZE/BUFFERS foram executados **somente nessa base local**.



| Cenário | p50 ms antes → depois | p95 ms antes → depois | chamadas SQL/req | bytes resposta/req | CPU processo ms/12 amostras |

|---|---:|---:|---:|---:|---:|

| Resumo amplo | 733.34 → 490.36 | 2848.64 → 1172.21 | 2 → 1 | 22196 → 20993 | 9783.0 → 6482.0 |
| Setor + cliente | 235.32 → 237.88 | 390.47 → 317.88 | 2 → 1 | 21895 → 20738 | 2515.0 → 2563.0 |
| Série exata | 12.18 → 10.89 | 30.35 → 26.87 | 2 → 1 | 1178 → 1278 | 142.0 → 123.0 |



A nova resposta inclui KPIs e período explícito; o tamanho não necessariamente cai em todos os cenários. Queda nas viagens SQL não garante queda no tráfego SQL interno, CPU/CU ou escrita. Os números reais da auditoria (432,27 ms médios etc.) pertencem a outra janela/dataset e **não foram usados como baseline comparável deste benchmark**. Os JSONs e planos completos estão em `homologacao-local/`.



## Matriz da missão e pendências



| Fase | Entregue | Não validado / condicionado |

|---|---|---|

| A | cópia íntegra, hashes, mapa, baseline, diagnóstico optativo | métricas frontend/API/SQL/CU de todos os fluxos sob carga real equivalente |

| B | GET local, proteção de leituras/cache, agrupamento SQL Neon, manutenção explícita, agregação Epóxi | homologação das fusões em snapshot completo; paginação Série/virtualização não aplicadas sem benefício comprovado |

| C | reescrita OP, planos locais, equivalência, filtros/datas, totais e KPIs | plano/estatísticas PostgreSQL 17/18 reais, dados mascarados de produção e carga concorrente |

| D | UI OP integrada e modal; perfis cobertos por testes | revisão manual completa mobile/teclado e dados de líderes reais |

| E | sequenciamento, limites, replay/staging, instrumentação dos importadores | p50/p95 de parse/transformação/validação/upload/finalização de todos os arquivos reais; projeção produtividade permanece desligada |

| F | suíte/build, comparação SQL/código, ZIP, rollback, plano SQL separado | consumo, segurança/RLS/TLS e homologação ponta a ponta em ambiente autorizado |



**Barreira para aprovação de consumo/publicação:** medir as mesmas planilhas, filtros, sessões e número de repetições nas duas versões em homologação autorizada. Separar frio/quente; coletar rede e bytes de resposta, SQL calls/total_exec_time/rows, CPU/CU/compute, pico de conexões e volume de escrita. Incluir navegação, filtros rápidos, modal, aprovação, Série, produtividade e todos os importadores. Não resetar estatísticas de produção. Não executar EXPLAIN ANALYZE em produção. A comparação do tráfego SQL deve incluir JSON agregado no caminho Neon. Se qualquer métrica relevante aumentar, investigar e ajustar antes de aprovar; não inferir consumo pelo tempo de tela.



## Segurança, entrega e reversão



As questões preexistentes de RPCs SECURITY DEFINER/anon, RLS sem política, view e TLS/SESSION_SECRET têm plano separado em `docs/SEGURANCA_E_SQL_PROPOSTO.md`. Elas não foram corrigidas em produção nem mascaradas como resolvidas. SQLs de instalação originais estão preservados, sem execução automática. `docs/EXECUCAO_E_ROLLBACK.md` distingue mock local, servidor real, configuração, manutenção e rollback.



`ORIGINAL_VS_OTIMIZADO.patch` compara fonte, testes e configuração; `MANIFESTO_COMPARACAO.json` contém hashes de arquivos adicionados, alterados, removidos e preservados. Artefatos de build, evidências geradas e esta documentação não poluem o patch de implementação. `SHA256SUMS.txt` acompanha os artefatos finais. Na retomada em 03/11/2026, os dois ZIPs de entrada já não estavam no diretório Downloads informado; por isso não foi possível recalcular seus hashes binários. As duas cópias extraídas do fonte original permanecem no workspace e foram comparadas arquivo a arquivo, sem divergências. O manifesto registra SHA-256 do fonte original e do novo; não se inventou um hash para os ZIPs ausentes. Dependências de produção do lockfile devem ser tratadas como herdadas; não foi realizada remediação geral de vulnerabilidades fora do escopo.
