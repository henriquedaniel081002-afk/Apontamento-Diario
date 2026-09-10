# Pendências de Aprovação — ajuste de ações

## Resultado

A fila existente, seu contador, filtros, paginação e visual foram preservados.

- **Excluir** abre a confirmação existente do sistema, identificando data, setor e ID.
- Cancelar não envia nenhuma operação de exclusão.
- A Coordenação pode aprovar registros **Aguardando Produção**, inclusive quando ainda não estão complementados. Nenhuma produção é criada e nenhuma quantidade é alterada.
- O bloqueio de complemento continua valendo quando existe produção importada.
- O fluxo original de aprovação/desfazer e a exclusão original fora da fila permanecem com o comportamento anterior.
- Este ZIP não possui Reprovar nem status REPROVADO. Nenhum deles foi criado.

## Exclusão e produção vinculada

A fila agrupa todas as ocorrências de um apontamento. Portanto, Excluir remove as cinco coleções de ocorrências desse apontamento, inclusive ocorrências de outros tipos e turnos do mesmo conjunto, que continuam visíveis na fila.

Se houver produção vinculada, **as linhas de produção e o cabeçalho do apontamento são mantidos**, pois apagar o cabeçalho poderia excluir a produção por cascata ou violar uma chave estrangeira. Sem ocorrências, esse conjunto deixa a fila. O aviso de confirmação informa que a produção será preservada.

Se não houver produção, as ocorrências e o cabeçalho são removidos. Programação e outros apontamentos não são atingidos. É reutilizada a função existente `deleteOccurrenceCollections`; não há exclusão manual de produção.

## Segurança e concorrência

As ações usam autenticação, permissão de Coordenação e o pool PostgreSQL principal existente. Não há alterações em Neon/Supabase, variáveis de ambiente, schema, triggers, cálculos ou importações.

Cada ação da fila exige a versão retornada pela consulta, baseada no campo já existente `atualizado_em`. O servidor bloqueia o apontamento com `FOR UPDATE`, confere versão, status PENDENTE e existência de ocorrências, e executa a alteração dentro de uma transação. Registro já removido retorna 404; versão/status alterado retorna 409. Nesses casos, a interface consulta novamente a fila, mantendo os filtros. Uma falha durante a operação provoca rollback completo.

Enquanto a requisição está em andamento, as ações ficam bloqueadas. Uma trava imediata também impede cliques duplicados antes da próxima renderização. A interface só altera os registros locais após sucesso da API; falhas são mostradas dentro do modal.

## Arquivos alterados

Cinco arquivos de implementação:

1. `server.ts`: versão na consulta; função transacional isolada; DELETE exclusivo da fila; desvio explícito do PATCH quando enviado `escopo: PENDENCIAS`. O comportamento original sem esse escopo permanece.
2. `src/services/coordenacaoService.ts`: chamada das ações da fila, reutilizando autenticação e invalidação de caches existentes.
3. `src/services/pendenciasAprovacaoService.ts`: campo de versão no tipo do resultado.
4. `src/components/coordenacao/PendingApprovals.tsx`: confirmação, botão Excluir, aprovação manual sem produção, bloqueios e feedback de erro.
5. `src/pages/CoordenacaoPage.tsx`: atualização local após as ações novas.

Dois arquivos de testes atualizados: `server.pendencias.test.ts` e `src/components/coordenacao/PendingApprovals.test.tsx`.

Este relatório também foi atualizado. A pasta `dist` foi regenerada pelo build. A estrutura do pacote e a pasta `.git` recebida foram preservadas; nenhum histórico Git foi removido desta entrega.

## Validação

| Verificação | Resultado |
| --- | --- |
| `npm run check` no ZIP original | 110 testes aprovados; 4 falhas preexistentes |
| `npm run check` após o ajuste | 124 testes aprovados; as mesmas 4 falhas preexistentes |
| Testes da fila/API | 32 aprovados |
| `npm run build` | Aprovado, incluindo TypeScript |
| PostgreSQL local via PGlite, com dados fictícios | Aprovação normal e sem produção, exclusão com/sem produção, proteção de versão/status, registro removido, rollback e preservação de produção/programação/outros registros aprovados |
| Consulta SQL atualizada | Contador, tipos, filtros, paginação, versão, legado e vazio validados |

As quatro falhas preexistentes permanecem nos testes de AderenciaAnualPage, ApontamentoPage, DayDetailModal e EpoxiDashboard. Não foram corrigidas, removidas nem desabilitadas. O comando check termina com erro por esses casos; o build separado passou. O aviso de bundles maiores que 500 kB foi mantido.

Não houve acesso aos bancos reais nem alteração em dados de produção. A validação local não substitui homologação no ambiente real. Não foi realizada nova inspeção visual por navegador, cujo acesso local já havia sido bloqueado neste ambiente. Os componentes compartilhados de layout e confirmação foram reutilizados sem modificações.

## Uso

Utilize as mesmas configurações de ambiente atuais; não há SQL de migração para executar. Na Coordenação, abra **Ver pendências**. Use **Excluir** e confirme, ou **Aprovar apontamento**, inclusive nos registros identificados como Aguardando Produção.
