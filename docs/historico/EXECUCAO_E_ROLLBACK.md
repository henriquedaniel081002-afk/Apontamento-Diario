# Execução e rollback — entrega local de 03/11/2026



Esta entrega não foi publicada e não executou comandos em Neon ou Supabase reais. As alterações de banco continuam sujeitas a autorização separada. Os SQLs de instalação que vieram no ZIP foram preservados, mas NÃO são uma etapa automática desta atualização.



## Requisitos e preparação



Use Node.js 22.x, conforme `engines` do projeto; verificação realizada com 22.23.4. Descompacte em uma pasta nova e rode `npm ci`. Não copie `node_modules` de outra instalação. O ZIP contém fonte e build de referência, sem `.git`, `.env`, credenciais ou dependências instaladas. A dependência PGlite é exclusivamente de desenvolvimento/teste.



Os nomes e destinos de conexão permanecem:



| Configuração | Uso |

|---|---|

| DATABASE_URL | Pool SQL principal, Neon |

| ATRASO_DATABASE_URL | Pool SQL de Atrasos, se informado |

| SUPABASE_DATABASE_URL | Alternativa já existente para Atrasos |

| DATABASE_URL como fallback | Atrasos, quando nenhuma alternativa está informada |

| VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY | SDK no navegador: produtividade e aderência anual |

| SESSION_SECRET | Assinatura das sessões do backend |

| PORT / VERCEL | Portas/execução existentes |

| ITAM_PERF=1 | Diagnóstico de tempos do backend; opcional, desligado por padrão |

| VITE_PRODUTIVIDADE_PROJECAO_VALIDADA=1 | Projeção reduzida da view, somente após confirmar todas as 18 colunas em homologação |



Copie `.env.example` para `.env` somente na instalação escolhida. Reutilize a configuração autorizada daquele ambiente. Não coloque credencial SQL ou chave privilegiada em variáveis `VITE_*`. Esta entrega não leu os valores configurados no provedor. A alteração não exige novo pool, aumento de conexões, CU, índices ou políticas.



## Homologação inteiramente local, sem bancos externos



1. Mantenha as variáveis `VITE_SUPABASE_*` vazias e não copie credenciais reais.

2. Execute `npm run dev:mock` e abra `http://localhost:3000`.

3. A API de demonstração liga apenas em 127.0.0.1:3001, usa PGlite em memória e autenticação fictícia de coordenação. Não é o servidor de produção e não deve ser exposta na rede. As telas fora de Atraso não têm dados completos nessa demonstração.

4. A base sintética usa setembro/outubro de 2026, além dos casos de julho e novembro. Selecione explicitamente 01/09/2026–31/10/2026 para repetir a demonstração em outro mês.

5. `npm run check`, `npm run test:sql` e `npm run test:neon` executam testes locais. Os dois últimos reconstroem bases descartáveis em memória, não carregam `.env` nem importam o servidor real. `test:sql` usa relógio de referência fixo em 30/10/2026.



`npm run dev` e `npm start` são os servidores REAIS e utilizam os destinos configurados; não os execute com credenciais de produção para testar esta entrega. Após configurar um ambiente autorizado, rode `npm run build` antes de `npm start`. O build incluído é referência sem configuração Supabase; as variáveis `VITE_*` são incorporadas no build, portanto ele deve ser reconstruído para o ambiente de homologação.



## Diagnóstico optativo



No console do navegador de homologação, habilite `sessionStorage.setItem('itam:performance','1')`. Depois de repetir o fluxo, `window.itamPerformance.snapshot()` apresenta contagem, p50/p95 e bytes enviados por etapa; `window.itamPerformance.clear()` limpa os dados. O buffer tem limite de 1.000 amostras, não envia telemetria e não guarda conteúdo das planilhas. A instrumentação agrupa parse/validação em alguns importadores; não separa automaticamente todos os subpassos nem mede pintura de tela.



No backend, `ITAM_PERF=1` adiciona `Server-Timing` com tempo da API, tempo acumulado do cliente SQL e número de consultas. Esses tempos incluem espera do cliente e não substituem `total_exec_time` do PostgreSQL. Sem esse opt-in, não há wrapper de consultas nem consultas adicionais de diagnóstico. Colete Resource Timing/Network no navegador para bytes de resposta e carregamento completo. A medição de CU, conexões e escrita depende do provedor e permanece pendente.



## Manutenção de duplicidades



`POST /api/coordenacao/manutencao/consolidar-turnos` exige sessão de coordenação. Não há agendamento automático nem botão que a dispare ao abrir uma tela. Reutiliza a escolha/fusão canônica do original dentro de transação, com bloqueio de escrita na tabela `apontamentos`; falhas fazem rollback. Pode bloquear escritas concorrentes: testar em homologação e reservar janela de manutenção. Executá-la em produção é uma mutação e requer autorização explícita, backup e plano de recuperação; ela NÃO foi executada nesta tarefa. Casos de fusão com todos os tipos de filhos ainda devem ser conferidos com snapshot mascarado.



## Rollback



Antes da publicação autorizada, preserve o artefato e as variáveis da versão anterior. Para reverter esta atualização de código, restaure o pacote anterior, execute `npm ci` com seu lockfile e reconstrua com as mesmas variáveis. Não há DDL desta entrega a desfazer. Não reexecute SQLs de instalação por causa do rollback.



O rollback de código não desfaz uma importação já confirmada nem a manutenção de duplicidades. Uma importação OP incompleta preserva a ATIVA anterior; após a finalização, o fluxo original remove a importação anterior e a recuperação exige a planilha/backup apropriado. Importação mensal Neon continua confirmando dia a dia; se interrompida, dias anteriores podem estar confirmados. Reimportar somente após conferir os dados e o período, sem prometer atomicidade mensal que o original não tinha.
