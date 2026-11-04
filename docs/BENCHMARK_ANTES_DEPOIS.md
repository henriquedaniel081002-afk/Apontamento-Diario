# Benchmark antes/depois — missão 04/11/2026

## Método e validade

Comparação entre o ZIP autorizado e esta entrega, mesma carga sintética e processo/ambiente, ordem alternada. Windows, Node 22.23.4, PostgreSQL 18.6 WASM/PGlite 0.5.13. Não é Neon/Supabase remoto e não reproduz integralmente PostgreSQL 17, CPU de servidor, latência WAN, pooling, rede TLS ou cobrança. A máquina não é ambiente dedicado; p95 de 12 amostras é o maior valor observado, com variabilidade relevante. Não há intervalo de confiança nem promessa de ganho em produção.

Resumo: 21 cenários de equivalência e três seletividades medidas, 12 pares após medições iniciais/EXPLAIN. Importações e parser: 13 pares, primeiro separado, 12 usados nos percentis. CPU é soma de process.cpuUsage das 12 operações do processo Node/PGlite, não CPU isolada do banco. Campos firstMs/firstSampleMs/originalFirstMs são primeira amostra na base já inicializada; NÃO representam cold start de banco. Frio real de provedor: NÃO MEDIDO.

O tempo de resumo é da chamada ao handler e inclui SQL/processamento local, sem HTTP WAN; planos EXPLAIN locais separados documentam execução SQL. A carga OP gera 53.462 linhas de programação mais casos de borda, apontamento para três de cada quatro séries, múltiplos setores/datas, conflitos canônicos e justificativas. As cópias usam a mesma carga. Cleanup usa base sintética de 400 apontamentos; produção mede substituição de 1.200 grupos. Setup, criação do banco e preparo de fixture ficam fora do tempo medido dos helpers. Não chamar esse tempo de importação mensal completa.

## Medições pareadas

Tempos em ms; coluna CPU em ms somados nas 12 amostras; bytes SQL e parâmetros são tamanho textual/JSON serializado, não bytes físicos na rede PostgreSQL.

| Operação | p50 antes → depois | p95 antes → depois | Chamadas por operação | Bytes por operação | CPU local total antes → depois |
|---|---:|---:|---:|---|---:|
| Resumo OP {"situacao": "TODOS"} | 812,85 → 752,29 | 1.473,98 → 1.043,53 | 1 → 1 | 20993 → 20993 bytes JSON resposta | 10126 → 10124 |
| Resumo OP {"setor": "BOBINAGEM", "cliente": "Cliente 2", "situacao": "TODOS"} | 177,41 → 178,11 | 355,36 → 325,85 | 1 → 1 | 20738 → 20738 bytes JSON resposta | 2375 → 2329 |
| Resumo OP {"serie": "2", "situacao": "TODOS"} | 8,67 → 7,61 | 12,05 → 10,54 | 1 → 1 | 1278 → 1278 bytes JSON resposta | 126 → 92 |
| OP PROGRAMACAO, lote 1.000 | 225,61 → 151,76 | 332,52 → 220,40 | 4 → 4 | SQL 109853 → 1089; parâmetros 128070 → 89125 | 2732 → 1781 |
| OP APONTAMENTO, lote 1.000 | 128,00 → 113,20 | 248,52 → 221,77 | 4 → 4 | SQL 109861 → 1097; parâmetros 107070 → 68125 | 1923 → 1623 |
| Produção cleanup | 401,70 → 39,80 | 601,81 → 92,93 | 635 → 6 | SQL 31517 → 903; parâmetros 3003 → 2380 | 5032 → 546 |
| Produção import | 1.484,15 → 124,45 | 2.409,84 → 367,48 | 1866 → 43 | SQL 160220 → 39293; parâmetros 25150 → 23333 | 19409 → 1829 |
| Parsing produtividade, XLSX 10.000 | 1.082,03 → 435,91 | 1.979,66 → 1.249,08 | 0 → 0 remotas | Arquivo 1248890 bytes em ambos | 14203 → 6688 |

Os payloads HTTP dos lotes OP comparativos são 239.077 bytes em ambas as versões: o ganho é entre backend e SQL, não redução do XLSX/JSON enviado pelo navegador. Foram mantidas as mesmas linhas lógicas e conteúdo nas tabelas; replay não adiciona linhas. A redução de comandos não comprova redução de WAL, de triggers por linha, de escrita física ou de custo.

O cenário geral do resumo melhora p95 com CPU praticamente igual. O filtro setor/cliente tem p50 ligeiramente pior; não há ganho uniforme por seletividade. Produtividade em páginas preserva todas as linhas/consultas e SELECT * padrão: há menor retenção explícita de objetos brutos, mas RAM e redução de tráfego NÃO MEDIDOS. Nenhuma projeção remota foi habilitada sem esquema validado.

## Navegação compilada no Chrome

Medição de clique Atraso → Visão OP, até linhas renderizadas e seletores disponíveis, dois frames concluídos. Recarregamento da aplicação fora do intervalo; perfis de coordenação, período padrão de outubro/novembro 2026, viewport 1440×1000. Treze pares alternados em dois builds estáticos, mesmo fixture PGlite. Rede do contexto bloqueada fora de localhost. Backend e recursos já inicializados; primeira navegação separada não é cold start de provedor.

| Métrica | Original | Entrega |
|---|---:|---:|
| Primeira navegação local (ms) | 1.233,44 | 1.317,34 |
| p50 das 12 seguintes (ms) | 1.281,14 | 1.281,41 |
| p95 das 12 seguintes (ms) | 1.381,03 | 1.518,13 |
| Respostas HTTP de OP na abertura | 2 | 2 |
| Corpos HTTP de OP decodificados (bytes) | 20983 | 21186 |

**Não foi demonstrada melhora do carregamento completo:** p50 estável e p95 maior nesta amostra. A nova API de opções acrescenta uma consulta SQL de combinações na abertura da coordenação (a antiga API de permissões não consultava dados para esse perfil). Ambas fazem duas chamadas HTTP, mas há 203 bytes adicionais nas respostas medidas. A opção dinâmica resolve o requisito funcional e não é consultada a cada digitação. Sem cache de servidor novo, cada atualização vê a importação ativa; evitar cache sem invalidação entre instâncias foi uma decisão de consistência. Não se aprova custo global com base no ganho isolado do resumo. Esta frente fica PENDENTE DE HOMOLOGAÇÃO.

## XLSX real sintético no navegador (uma execução; sem comparação de ganho)

Arquivo XLSX gerado com SheetJS, lido pelo parser real e enviado pelos controles reais da UI para API real de OP registrada no mock PGlite. Sessão fictícia, sem backend ou credencial de produção. Programação e apontamento, 1.001 linhas cada, envio sequencial em dois lotes (1.000 + 1), iniciar e finalizar; ambos importaram 1.001 registros. Não há p50/p95 por ser ensaio único.

- PROGRAMACAO: 455,55 ms do envio do arquivo pelo teste até status de importação; XLSX 74347 bytes; soma dos corpos POST 163421 bytes.
- APONTAMENTO: 624,82 ms do envio do arquivo pelo teste até status de importação; XLSX 74350 bytes; soma dos corpos POST 149407 bytes.

Parser OP herdado: 50.000 linhas válidas, 0 ignoradas, XLSX 3391918 bytes, 511,30 ms. Sem Worker novo e sem alegar ganho nesse parser, que não mudou. Interrupção/conflito/replay foram exercitados pelos testes de componente/API/PGlite. Arquivos reais mascarados, carga máxima de 200 mil e concorrência de produção não foram validados.

## Evidências e reprodução

- homologacao-missao/benchmark-sql.json: respostas comparadas, amostras e lotes OP; query-*.sql e plan-*.json: consultas/planos em banco descartável.
- benchmark-neon-imports.json: igualdade de snapshots, helpers, limites de data, rollback e amostras.
- benchmark-productivity-parse.json: preview idêntico e amostras de XLSX.
- benchmark-browser.json e browser-imports.json: navegação compilada e upload XLSX sintético.
- evidencias/: logs baseline/entrega, screenshots Mensal/OP/modal/mobile, verificacao-visual.json e ambiente.json. Scripts e instruções em evidencias/reproducao/README.md.
- homologacao-missao/regressao-herdada/: reexecução dos scripts antigos. Eles comparam outra fixture histórica e não servem para atribuir todos os ganhos ao ZIP desta missão.

Scripts da aplicação: npm run test:audit-sql; npm run test:imports; npm run benchmark:productivity. Não executar benchmarks simultaneamente. A comparação temporal da suíte inicial Node24 com a suíte final Node22 não foi usada como benchmark; os pares acima usam Node22.

## Aceite de consumo

RAM/heap de pico por operação, CPU/CU dos provedores, conexões de pico remotas, I/O, egress TLS, WAL e custo: **NÃO MEDIDO**. Consumo igual ou menor em Neon/Supabase: **NÃO VALIDADO**. A liberação exige mesma carga mascarada, perfis, seletividades, período e concorrência, 30+ amostras frias/quentes e observação por turno conforme CHECKLIST_HOMOLOGACAO.md. A média SQL histórica de 1.003,86 ms da auditoria não é baseline de tela e não foi utilizada para percentuais.
