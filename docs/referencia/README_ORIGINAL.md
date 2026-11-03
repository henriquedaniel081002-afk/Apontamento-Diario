# ITAM — Sistema de Apontamento Diário

Aplicação React/TypeScript integrada a PostgreSQL Neon por API Express.

## Novo fluxo de produção

Nesta versão, a produção deixa de ser digitada pelo apontador.

1. A **Coordenação** abre **Importar produção**.
2. Seleciona um arquivo `.xlsx` e informa a data que deve ser considerada.
3. O navegador lê somente a aba **Apontamento Final** e usa as colunas **DATA PRODUZIDA**, **POTÊNCIA**, **LINHA** e **SETOR**.
4. A quantidade é calculada pela contagem das linhas com a mesma combinação de setor + linha + potência na data selecionada.
5. Linhas sem correspondência, como `BIF` ou `POT` em setores válidos, precisam ser corrigidas para `MON` ou `TRI` antes da confirmação.
6. Registros com `LINHA = EPO` são direcionados ao **Epóxi**. Outros setores sem apontador correspondente são exibidos como ignorados.
7. A produção é associada ao apontador correto. Bobina AT/BT, Montagem Final MON/TRI e MPA MON/TRI continuam separados.
8. Ao entrar, o apontador vê os dias aguardando complemento, confere a produção bloqueada e adiciona somente **faltas** e **observações**.
9. Enquanto o apontador não concluir o complemento, a Coordenação visualiza **Aguardando complemento** e o registro não pode ser aprovado.

Uma nova importação da mesma data **substitui a produção importada anteriormente**. Faltas, observações e o status de aprovação que já existirem são preservados, conforme a regra definida para este fluxo.

A leitura do XLSX acontece no navegador; o arquivo completo não é enviado para a API. O servidor recebe apenas os grupos já agregados.

## Migração obrigatória do Neon

Antes de publicar esta versão, execute uma vez no SQL Editor do Neon:

`NEON_IMPORTACAO_PRODUCAO.sql`

O script adiciona os campos usados para diferenciar produção manual/importada e controlar se o apontador já complementou o registro. Ele não registra quem realizou a importação nem cria histórico específico da importação.

As colunas e estruturas de aprovação já utilizadas pelo sistema precisam continuar existentes no banco.

## Exportação Excel

A exportação da Coordenação mantém as abas:

- `produzido`
- `faltas`
- `obs`

As três incluem a coluna `status`, com `APROVADO` ou `PENDENTE`.

## Execução local

Requisitos: Node.js 20.19 ou mais recente e npm.

1. `npm ci`
2. Copie `.env.example` para `.env` e configure `DATABASE_URL` e `SESSION_SECRET`.
3. `npm run dev`
4. Abra `http://localhost:3000`.

## Verificações disponíveis

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run check`

## Deploy

`vercel.json` mantém o front-end como build estático e encaminha `/api/*` para `server.ts`. Configure `DATABASE_URL` e um `SESSION_SECRET` forte no ambiente de deploy.
