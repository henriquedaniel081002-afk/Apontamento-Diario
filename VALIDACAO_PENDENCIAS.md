# Visão de pendências de aprovação — ITAM

## Entrega

Novo cartão **Pendentes de Aprovação** na Coordenação, com total geral de apontamentos e total separado de ocorrências. A ação **Ver pendências** abre um modal com período, setor, tipo, paginação de 20 apontamentos e aprovação pelo fluxo existente. O período inicial abrange todos os registros; os filtros da página original não afetam esta visão.

O filtro de tipo seleciona apontamentos que possuem aquela ocorrência. Todas as ocorrências desses apontamentos continuam visíveis, pois a aprovação afeta o conjunto inteiro. O cartão continua mostrando o total geral mesmo quando o modal está filtrado.

## Regras identificadas e preservadas

- A aprovação pertence a `apontamentos.status_aprovacao`, não às linhas individuais das ocorrências.
- O código aceita somente **PENDENTE** e **APROVADO**. A operação inversa existente é **desfazer aprovação**, que retorna o apontamento a PENDENTE; não há REPROVADO nem encerramento por reprovação.
- Por isso, **não foi criado botão Reprovar**, novo status ou aprovação individual por ocorrência. Desfazer continua disponível na lista original da Coordenação.
- A fila consulta explicitamente PENDENTE, incluindo a compatibilidade existente com valor vazio/nulo e letras minúsculas. Valores como REPROVADO ou ENCERRADO, se encontrados, não entram na fila.
- Registros apenas de produção não são contados. Os cinco tipos consultados são Falta de Material, Máquina Quebrada, Não Conformidade, Faltas e Observações.
- Apontamentos com ocorrências, mas sem produção ou com produção importada ainda aguardando complemento, permanecem visíveis como pendentes, com aprovação bloqueada e motivo explicado.
- Uma linha antiga de faltas com quantidade 2 representa uma ocorrência dentro de um apontamento. O total de faltas não é confundido com o número de registros da fila.
- Linha/turno ausentes são identificados como não informados. Não são inferidos a partir da produção. O horário exibido é o de criação do apontamento, pois as consultas existentes não fornecem horário individual de cada ocorrência.

## Alteração mínima

Arquivos existentes modificados:

| Arquivo | Alteração |
| --- | --- |
| `server.ts` | Adição de um GET isolado, somente leitura. Todo o conteúdo anterior do servidor foi preservado. |
| `src/pages/CoordenacaoPage.tsx` | Importação e inserção do componente; tipo do argumento da função de aprovação restringido ao campo `id`, único campo já utilizado. Corpo da função preservado. |

Arquivos novos:

- `src/services/pendenciasAprovacaoService.ts`
- `src/components/coordenacao/PendingApprovals.tsx`
- `src/components/coordenacao/PendingApprovals.test.tsx`
- `server.pendencias.test.ts`
- Este relatório.

Comparação byte a byte contra o ZIP recebido: **142 arquivos originais de fonte/configuração/recursos preservados** e **2 arquivos de código existentes alterados**. `dist` foi regenerado pelo build para corresponder ao código entregue. O ZIP não inclui `node_modules` nem o histórico `.git`.

Não há alteração de schema, migração SQL, dependência, variável de ambiente, conexão, cálculo, importador, exportador, CSS global ou componente compartilhado. Nenhuma publicação foi realizada.

## Consulta e atualização

Novo endpoint: `GET /api/coordenacao/pendencias-aprovacao`.

Utiliza `auth`, `requireCoordenacao` e o `pool` PostgreSQL principal já existente. Os filtros são parametrizados. Uma consulta calcula totais, setores e página; uma segunda consulta em lote traz os detalhes apenas daquela página. Com o modal fechado, consulta somente o resumo. Não há uma consulta por registro nem busca de quantidades de produção para alimentar a fila.

A aprovação usa a mesma `handleApprovalChange`, `coordenacaoService.setApproval` e o mesmo PATCH original. Lista e contador são consultados novamente quando a Coordenação atualiza seus registros, inclusive após aprovação/desfazer, edição ou exclusão. Há atualização ao reabrir o modal, retornar à janela e clicar em Atualizar pendências. Respostas de consultas substituídas são descartadas, e erros não exibem contagem antiga como se fosse atual.

## Verificações executadas

| Verificação | Resultado |
| --- | --- |
| Instalação com `npm ci` | Concluída, sem alteração de dependências/lockfile |
| `npm run check` antes da alteração | 92 testes aprovados; 4 falhas preexistentes |
| 18 testes novos de API/interface | Todos aprovados |
| `npm run check` após a alteração | 110 testes aprovados; as mesmas 4 falhas preexistentes |
| `npm run build` final | Aprovado, incluindo TypeScript |
| SQL em PostgreSQL local via PGlite | Contagens, 5 tipos, status, legado, filtros, paginação, ausência de produção, aprovação/desfazer e vazio validados com dados fictícios |
| Preservação do servidor | Removendo apenas o bloco novo, o arquivo coincide integralmente com o original |

As quatro falhas já presentes no ZIP são:

1. `AderenciaAnualPage.test.tsx`: `scrollIntoView` não implementado pelo ambiente jsdom.
2. `ApontamentoPage.test.tsx`: expectativa `toHaveValue` com `stringMatching` falha para a data recebida.
3. `DayDetailModal.test.tsx`: expectativa de detalhes operacionais não corresponde à renderização original.
4. `EpoxiDashboard.test.tsx`: expectativa do indicador de produção não corresponde ao resultado original.

Esses testes e seus módulos foram preservados. `npm run check` encerra com falha por esses quatro casos; o build foi executado separadamente e passou. O aviso de bundle acima de 500 kB foi mantido, sem refatoração. O ambiente local usa Node 24.19; o requisito Node 22 do projeto não foi alterado.

## Limites da validação

O ZIP não contém credenciais reais de ambiente. Não houve acesso aos bancos reais Neon/Supabase nem execução de importações, exclusões ou aprovações nos dados de produção. Os testes existentes cobrem parte dos fluxos listados na solicitação; não equivalem a uma homologação completa de todos eles em produção.

A inspeção visual pelo navegador foi tentada, mas os endereços locais foram bloqueados pelo ambiente (`ERR_BLOCKED_BY_CLIENT`). Portanto, não se afirma homologação visual em diferentes resoluções. A nova tela reutiliza ModalShell, Surface, filtros e botões existentes, com limite de altura da viewport, rolagem interna, quebra de texto e cards em uma coluna em telas menores.

## Como usar

Execute o projeto com as mesmas configurações de ambiente já utilizadas. Não há SQL adicional para executar. Na Coordenação, abra **Pendentes de Aprovação → Ver pendências**, aplique os filtros desejados e use **Aprovar apontamento** após analisar todas as ocorrências do conjunto.
