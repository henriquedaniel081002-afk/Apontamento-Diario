# ITAM — Sistema de Apontamento Diário

Aplicação React/TypeScript para registro diário de produção, faltas e observações, integrada a PostgreSQL Neon por uma API Express.

## Execução local

Requisitos: Node.js 20.19 ou mais recente e npm.

1. Instale exatamente as dependências do lockfile: `npm ci`.
2. Copie `.env.example` para `.env` e preencha `DATABASE_URL` e `SESSION_SECRET`.
3. Inicie front-end e API: `npm run dev`.
4. Abra `http://localhost:3000`.

Para revisar a interface sem acessar o Neon, use `npm run dev:mock`. A API fictícia aceita qualquer senha não vazia para os perfis disponibilizados por ela e mantém os dados apenas em memória enquanto o processo estiver aberto.

A `DATABASE_URL` é utilizada exclusivamente por `server.ts` e não é enviada ao navegador. Arquivos `.env` são ignorados pelo Git.

## Perfis e regras preservadas

- `APONTADOR`: cria apontamentos independentes e consulta, edita ou exclui somente seus próprios registros.
- `COORDENACAO`: consulta todos os registros, acompanha pendências, filtra, edita, exclui, aprova/desfaz aprovação e exporta os resultados.
- Cada POST cria um novo apontamento, inclusive quando já existe outro do mesmo usuário e data.
- Bobinagem mantém `AT` e `BT` separados.
- Montagem Final e MPA mantêm `MON` e `TRI` separados.
- O filtro inicial da Coordenação usa o último dia útil anterior e também controla o painel de pendências.
- O Excel mantém as abas `produzido`, `faltas` e `obs`; justificativas de faltas também entram em `obs`.
- Novos apontamentos iniciam como `PENDENTE`; a Coordenação pode marcá-los como `APROVADO`. Se um apontamento aprovado for editado, ele volta automaticamente para `PENDENTE` e precisa ser aprovado novamente.
- O botão `Atualizar` da Coordenação força uma nova consulta à API sem cache.

As permissões são validadas novamente na API. A interface nunca é a única barreira de autorização.

## Migração do Neon

Esta versão inclui `NEON_APROVACAO_APONTAMENTOS.sql`, que adiciona os campos de aprovação necessários à tabela `apontamentos`. Execute esse arquivo no SQL Editor do Neon **antes de publicar esta versão**.

A migração de aprovação não substitui ajustes anteriores do banco. O banco também deve continuar possuindo `tipo_bobina` e permitindo múltiplos apontamentos do mesmo usuário/data conforme a configuração já utilizada pelo sistema.

## Verificações

- `npm run typecheck`: valida TypeScript.
- `npm run test`: executa os testes automatizados com dados fictícios.
- `npm run build`: valida tipos e gera o bundle Vite.
- `npm run check`: executa typecheck, testes e build em sequência.
- `npm audit --omit=dev`: audita dependências de produção.

Os testes e a validação visual desta entrega usam respostas fictícias e não acessam o Neon. Login e CRUD reais devem ser verificados posteriormente em um ambiente de teste controlado.

### Matriz de QA desta entrega

- `npm ci`, `npm run check`, `npm run build` e `npm audit --omit=dev` aprovados.
- 19 testes automatizados aprovados, cobrindo sessão expirada, Bearer token, dia útil anterior, 12 unidades, AT/BT, MON/TRI, filtros, fronteira caracterizada de sete dias e estrutura do XLSX.
- Fluxos fictícios validados no navegador: login válido e inválido, wizard, rascunho entre etapas, duplicidade, dois POSTs na mesma data, edição, exclusão, filtros, estados vazios e modais por teclado.
- QA responsivo executado em 1440×900, 1024×768, 768×1024, 390×844 e 320 px, sem overflow global ou erros no console.

## Integridade do backend

`server.ts` possui o novo endpoint exclusivo da Coordenação para aprovação/desfazer aprovação e cabeçalhos `no-store` nas rotas da API. As regras JWT existentes permanecem; somente usuários com perfil `COORDENACAO` podem alterar o status de aprovação.

## Deploy

`vercel.json` mantém o front-end como build estático e encaminha `/api/*` para a função Express em `server.ts`. Configure `DATABASE_URL` e um `SESSION_SECRET` forte no ambiente de deploy.
