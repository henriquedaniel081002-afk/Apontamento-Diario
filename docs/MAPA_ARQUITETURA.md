# Mapa funcional e acesso



Inventário estático do ZIP e do código entregue; não é descoberta dos bancos reais. `INVENTARIO_CODIGO.json` lista todos os endpoints Express, serviços, páginas e referências de tabelas encontradas no fonte. Nenhuma rota existente foi removida. A rota nova é a manutenção explícita de turnos.



| Tela/fluxo | Serviço/entrada | API/destino | SQL/tabelas e autorização |

|---|---|---|---|

| Login | authService/sessionStore | POST /api/auth/login → pool principal | usuarios, acessos, setores/linhas; JWT; perfis COORDENACAO/APONTADOR |

| Apontamento e ocorrências por turno | apontamentoService, TurnOccurrencePage | /api/apontamentos, /data/:data, /ocorrencias, /:id/complemento | Neon: apontamentos, producao, faltas, observacoes, paradas_falta_material, paradas_maquina, nao_conformidades; usuário/setor/linha conforme autorização original |

| Histórico | apontamentoService | GET /api/apontamentos | Mesmo pool/conjuntos; dados do apontador, consultas sem overlay global |

| Registros da coordenação | coordenacaoService | /api/coordenacao/apontamentos; edição/exclusão | Neon: apontamentos e sete blocos auxiliares; exige coordenação |

| Pendências/aprovação | pendenciasAprovacaoService | /pendencias-aprovacao e /apontamentos/:id/aprovacao | Neon: ocorrências/complemento/status; preserva bloqueio de produção importada não complementada e critérios de aprovação |

| Não Conformidades | naoConformidadesService | /api/nao-conformidades, PATCH /:id/reparar | Neon: nao_conformidades/apontamentos/usuarios; escopo e transições originais mantidos |

| Aderência Mensal/dashboard | dashboardService | /api/coordenacao/dashboard | Neon: produção/programação/apontamentos/ocorrências; coordenador amplo, apontador com escopo original |

| Produção Diária | producaoDiariaService | /api/coordenacao/producao-diaria | Neon: produção/apontamentos/setores/linhas; coordenação |

| Controle Faltas | controleFaltasService | /api/coordenacao/controle-faltas | Neon: faltas/apontamentos/setores/linhas; coordenação |

| Aderência Anual | aderenciaAnualService | SDK Supabase (VITE_SUPABASE_URL) | public.aderencia_anual, leitura paginada/upsert por mês; UI de coordenação, segurança efetiva depende dos grants/RLS existentes |

| Produtividade Individual | productivity/services/dashboardService, importService | SDK Supabase e RPCs | vw_producao_detalhada, dias_trabalho, colaboradores_controle/desligados; produção/jornada por RPC; seleção de acesso UI original mantida, RPCs públicas pendentes de remediação |

| Atraso > Série | atrasoService | /api/coordenacao/controle-atrasos e /importar → pool Atrasos | controle_atrasos; coordenação; base completa mantém filtros, totais, impressão e exportações |

| Atraso > OP | apiClient, GestaoAtrasosPage | /api/gestao-atrasos/permissoes,resumo,op/:op,justificativas | pool Atrasos: atrasos_importacoes, programacao_detalhada, apontamentos_detalhados, justificativas; coordenação ampla, apontador somente setores autorizados nos detalhes/escrita; agregado de outros setores somente de OP visível |

| Importar produção diária/mensal | importProductionExcel/MonthExcel → coordenacaoService | /importar-producao, /importar-producao-mes-finalizar | Neon: reimportação por dia, produção agrupada e associação de apontadores; mantém faltas/observações/aprovação e fechamento mensal original; coordenação |

| Importar programação | importProgramacaoExcel → coordenacaoService | /importar-programacao | Neon: programacao/setores/linhas, coordenação |

| Importar Série | parseExcel → atrasoService | /controle-atrasos/importar | pool Atrasos, substituição transacional original, coordenação |

| Importar OP | importDetailedExcel → apiClient | /importacoes/iniciar,lote,finalizar | pool Atrasos, staging PENDENTE/ATIVA, máximo 200 mil; lotes sequenciais até 1.000, coordenação |

| Importar produtividade | productivity/services/importService | RPC importar_produtividade | Supabase: produção e jornada; contrato existente preservado; mitigação do anon EXECUTE em plano separado |

| Importar aderência anual | aderencia-anual/utils/importExcel | SDK upsert de aderencia_anual | Supabase, sem nova concorrência/poll |



## Invariantes e decisões



- Mantida seleção canônica `DISTINCT ON (serie,setor)` pela menor data e desempate de OP. Filtros de OP/linha/cliente e limite inferior da data ficam após a escolha canônica. Somente restrições seguras por série/setor e teto temporal são antecipadas.

- Sem redução arbitrária do histórico de produtividade: admissão/primeira produção, desligamento, matrícula, turno, horas extras e conversões continuam usando a base completa. A ordenação por data e ID torna as páginas determinísticas, mas não cria snapshot entre chamadas se houver importação concorrente.

- Não introduzida paginação na Série, pois isso mudaria contagens/exportações; sem benefício de consumo demonstrado para a base pequena. O lazy loading existente foi preservado; não adicionada virtualização sem medição que a justifique.

- Cache em memória existente preserva TTL. Gerações impedem que consultas anteriores a uma mutação repovoem o cache; mudança de sessão invalida caches. GETs idênticos simultâneos podem compartilhar a mesma promessa; respostas não ganham cache permanente.

- Somente leituras são canceladas/ignoradas. POSTs/importações não são abortados por uma troca de filtro.

- Critérios sem produção importada, situação de atraso, prazo e histórico append-only continuam explícitos. KPIs contam o conjunto filtrado inteiro, incluindo páginas não visíveis. OPs/transformadores são distintos; outros cartões usam OP/setor ou produção por setor conforme legenda.
