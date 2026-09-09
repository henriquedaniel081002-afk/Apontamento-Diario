# Redesign visual — Sistema de Apontamento Diário ITAM

## Entrega e limites de validação

Redesign implementado na base visual compartilhada e nos estilos de todos os módulos. A implementação preserva integralmente os arquivos que contêm regras, serviços, autenticação, consultas e cálculos.

**Status: código entregue e build aprovado; homologação visual em navegador e validação com bancos reais pendentes.** O navegador deste ambiente bloqueou o acesso à aplicação local. Não houve inspeção de screenshots nem teste real nas resoluções solicitadas. Os testes em JSDOM não calculam layout e não comprovam ausência de sobreposição, overflow ou clipping. Não apresentar esta entrega como homologada para produção sem essa etapa.

## Arquivos alterados

A classificação foi registrada antes da edição em `CLASSIFICACAO-PREVIA.md`. Somente estes arquivos existentes foram alterados:

| Arquivo | Classificação | Alteração |
|---|---|---|
| `src/index.css` | VISUAL | Tokens em grafite, hierarquia, login, sidebar, cabeçalhos, filtros, modais, tabelas, gráficos, estados, acessibilidade visual e responsividade. |
| `src/components/common/ui.tsx` | VISUAL | Exclusivamente strings de classes: botões, superfícies, cabeçalhos, KPIs, tabelas, progresso, vazio, erro e stepper. |
| `src/dashboard/dashboard.css` | VISUAL | Aderência Mensal, indicadores, gráficos diários, Epóxi e detalhamento. |
| `src/dashboard/controle-faltas.css` | VISUAL | Faltas, contraste dos gráficos, rankings e distribuição dos painéis. |
| `src/producao-diaria/producao-diaria.css` | VISUAL | Cards comparáveis, percentual fora do anel e gráfico com rolagem localizada. |
| `src/productivity/productivity.css` | VISUAL | Integração visual da Produtividade, filtros legíveis, KPIs, tabela, analytics, configurações e overlays. |
| `src/atraso/atraso.css` | VISUAL | Seletor semântico de status, gráfico selecionado e rolagem localizada. |

Os 137 outros arquivos do projeto são idênticos ao original, conforme SHA-256. Isso inclui `server.ts`, páginas React com estado/lógica, `Header.tsx`, `LoginPage.tsx`, `ModalShell.tsx`, todos os serviços, importadores, exportadores, tipos, cálculos, SQL, configurações, `package.json`, lockfile e `.env.example`.

Em `ui.tsx`, a comparação da árvore sintática TypeScript confirmou identidade após normalizar somente literais de texto; o diff foi revisado e todas as diferenças são classes de apresentação. Nenhum texto funcional, evento, prop, cálculo, condição ou estrutura JSX foi reescrito.

## O que mudou na interface

- Dark mode com níveis distintos de superfície e bordas neutras. Removidos gradientes verdes generalizados, ornamentação circular dos cards e movimentos de elevação no hover.
- Sidebar mais estreita no desktop, item ativo discreto e navegação com rolagem própria em telas baixas. Ordem, perfis, recolhimento e navegação mobile mantidos.
- Login com painel de marca mais sóbrio, hierarquia tipográfica e composição compacta em telas pequenas.
- PageHeader, campos, ações, registros e filtros com padrões comuns. Etapas preservadas, rótulos com quebra de linha e destaque visual da etapa ativa.
- KPIs com rótulo, valor e contexto. Na Produção Diária, o valor fica fora do anel para reduzir risco de sobreposição.
- Aderência Mensal com indicadores principais e operacionais reorganizados nos breakpoints menores. Fórmulas, escalas numéricas e datasets preservados.
- Aderência Anual com controle de ano destacado e altura de gráfico adaptada a telas baixas. Todos os anos e dados continuam disponíveis.
- Produtividade utiliza os mesmos tokens e padrões; fontes anteriormente entre 8 e 10 px foram aumentadas. Filtros e cards reorganizados para acomodar a sidebar.
- Tabelas preservam colunas e alinhamentos, com rolagem local e indicação nas tabelas compartilhadas em mobile. Gráficos extensos mantêm largura mínima útil e rolagem local.
- Tooltips, eixos, legendas, grid, progresso, modais e notificações recebem acabamento consistente. Cores dos dados e estados continuam preservadas.
- Nenhuma biblioteca nova, nenhuma mudança de stack, nenhum segundo design system.

## Validações executadas

| Verificação | Original | Redesign |
|---|---|---|
| `npm ci` | Concluído | Mesmo lockfile e mesmas dependências instaladas |
| `npm run typecheck` | Aprovado | Aprovado, também executado pelo build |
| `npm run test` | 92 aprovados / 4 falhas | 92 aprovados / mesmas 4 falhas |
| `npm run build` | Aprovado | Aprovado |
| Comparação SHA-256 | Baseline registrado | 137 arquivos protegidos idênticos; 7 visuais alterados |
| Testes adicionais isolados de componentes | — | 12 aprovados |
| Inspeção visual em navegador | Não realizada | Bloqueada pelo ambiente |
| Integração com Neon/Supabase reais | Não executada | Não executada; código e configuração preservados |

As quatro falhas preexistentes são:

1. `AderenciaAnualPage.test.tsx`: `scrollIntoView` indisponível no ambiente JSDOM.
2. `ApontamentoPage.test.tsx`: expectativa de `toHaveValue(StringMatching)` no fluxo Solda.
3. `DayDetailModal.test.tsx`: expectativa da região acessível `Produção por potência`.
4. `EpoxiDashboard.test.tsx`: expectativa de produção total `35` não atendida no fixture original.

Nenhum teste original foi alterado para esconder essas falhas. `npm run check` continua retornando falha porque a suíte original contém esses quatro casos. Typecheck e build foram executados separadamente e passaram.

Os 12 testes adicionais usaram fixtures sintéticos e cobriram a renderização de Registros, Histórico, Aderência Mensal, Produção Diária, Aderência Anual, Faltas, Produtividade e Atraso; seleção inicial do Apontador; validação de campos vazios no login; troca exclusiva de status e abertura da impressão no Atraso; abertura de configurações e retorno ao dashboard de Produtividade. Não comprovam resultados de impressão, imports com banco real ou layout. Esse ambiente isolado, suas configurações, mocks e fixtures não integram o ZIP.

O aviso de chunks acima de 500 kB já existia no baseline e permanece. O ambiente de execução forneceu Node 24; o requisito Node 22.x do projeto foi mantido sem alteração.

## Homologação pendente

| Resoluções solicitadas | Situação |
|---|---|
| 320, 375 e 430 px | Regras responsivas implementadas; inspeção real pendente |
| 768, 1024 e 1280 px | Regras consideram a largura da sidebar; inspeção real pendente |
| 1366 × 768 | Ajustes para notebook implementados; inspeção real pendente |
| 1440 e 1920 px | Expansão de containers e grids implementada; inspeção real pendente |
| Alturas reduzidas | Sidebar, modais e loading com tratamento de rolagem; inspeção real pendente |

Para a homologação, verificar valores longos, seletor de ano, menus abertos, tabelas completas, foco de teclado, sidebar recolhida/mobile, todas as etapas do Apontador e modais de importação/edição/exclusão. Confirmar com as credenciais e ambiente reais: login/logout/sessão; aprovação; importações XLS/XLSX/XLSM; exportação; impressão/PDF; filtros e detalhamento dos dashboards.

## Executar o projeto

Use o mesmo procedimento e as mesmas variáveis de ambiente do projeto original, conforme `README.md` e `.env.example`. Nenhuma credencial foi incluída ou substituída. Com Node 22.x:

```sh
npm ci
npm run dev
```

O ZIP inclui o código completo e a documentação original. Não inclui `node_modules`, build gerado, histórico `.git` ou arquivos temporários. Esses itens não são necessários para executar o projeto e podem ser regenerados quando aplicável. Nenhuma alteração foi publicada na Vercel e nenhum banco recebeu escrita.
