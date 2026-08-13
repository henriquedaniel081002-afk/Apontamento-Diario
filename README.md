# ITAM — Sistema de Apontamento Diário

Front-end React/TypeScript integrado a PostgreSQL Neon por uma API Express.

## Configuração

1. Instale as dependências: `npm install`
2. Configure o arquivo `.env` com `DATABASE_URL` e `SESSION_SECRET`.
3. Rode `npm run dev`.
4. Abra `http://localhost:3000`.

## Segurança

A `DATABASE_URL` é usada somente pelo servidor (`server.ts`) e nunca é enviada ao navegador. O arquivo `.env` é ignorado pelo Git.

## Login e perfis

Os usuários exibidos na tela são definidos no front-end para facilitar a seleção, mas a senha e as permissões são validadas no Neon pela função `autenticar_usuario`.

- `APONTADOR`: mantém o fluxo normal de apontamento e histórico do próprio acesso.
- `COORDENACAO`: abre uma única tela de consulta geral, com filtros por dia, setor, linha e potência. Pode visualizar detalhes, editar e excluir qualquer apontamento.

As operações globais da Coordenação também são validadas no backend; não dependem apenas de esconder ou exibir botões no front-end.

## Dados

Produção, faltas, observações e histórico são gravados/lidos do Neon. O `localStorage` é usado apenas para manter a sessão/token do navegador.
