# Gestão de Atrasos por OP — versão baseada no ZIP original de 29/10/2026

## Importante
A base desta entrega é exatamente **Apontamento Diario(1).zip**, recebido para auditoria. **Não publique em produção antes de homologar.** Não foi realizada nenhuma alteração no Neon ou Supabase reais.

## Arquitetura e conexão
- `DATABASE_URL`: permanece sendo usado pelo Neon para autenticação, produção, programação, acessos e demais módulos existentes.
- `ATRASO_DATABASE_URL` (ou o fallback atual `SUPABASE_DATABASE_URL`): mesma conexão que o código original já usa para o Controle de Atrasos; a nova Gestão por OP usa o `atrasoPool` já existente. Não modificar credenciais existentes se já apontam para o Supabase certo.
- O SQL `SUPABASE_GESTAO_ATRASOS.sql` cria **somente quatro tabelas novas** e seus índices: `atrasos_importacoes`, `atrasos_programacao_detalhada`, `atrasos_apontamentos_detalhados`, `atrasos_justificativas`. Não altera `controle_atrasos`.
- Usuários e permissões são conferidos no Neon por intermédio do backend existente; o Supabase apenas registra ID e login da justificativa sem FK entre bancos.

## Implantação em homologação
1. Tenha uma cópia do banco Supabase de Atrasos e uma implantação de homologação do sistema.
2. Antes de executar SQL, confira que esse Supabase contém `public.controle_atrasos` e que `ATRASO_DATABASE_URL` existente aponta para ele. Faça backup.
3. Execute **somente** `SUPABASE_GESTAO_ATRASOS.sql` no SQL Editor desse projeto. Não execute o antigo SQL do Neon.
4. Instale dependências no ZIP atualizado (`npm ci`) e rode `npm run check`. Corrija quaisquer erros antes do deploy.
5. Configure a mesma conexão Supabase de Atrasos já utilizada, sem trocar `DATABASE_URL`.
6. Faça deploy de homologação. Verifique todas as telas originais, inclusive Produtividade Individual e a importação simplificada.
7. Logado como Coordenação, importe no novo menu os arquivos BASE PROG e Apontamento. A nova importação não substitui os arquivos importados anteriormente nos módulos antigos.
8. Confira resumo de OPs, progresso por setor e os **3 avisos de divergência** identificados no recorte de setembro/outubro de 2026.
9. Reimporte um arquivo, confirme que dados da versão anterior foram substituídos; simule falha antes de finalizar e verifique que o anterior continua ativo.
10. Confira que liderança tem acesso de leitura e pode justificar somente seus setores, e que justificativas persistem após reimportar.
11. Compare métricas de consumo, I/O, storage, CPU e número de conexões do Supabase e Neon com a linha de base.

## Regras da importação
- Janela: mês atual e mês anterior no fuso America/Manaus; a importação detalhada guarda apenas o recorte selecionado.
- Programação e apontamento são importados **separadamente**, cada um substituindo sua própria importação ativa somente após finalizar todos os lotes com sucesso.
- A importação com a mesma série+setor em OPs diferentes é **permitida** e gera aviso (entre os arquivos ou dentro do mesmo arquivo); a OP original não é corrigida.
- Repetir a combinação idêntica série+setor+OP no mesmo Excel continua sendo erro de duplicação (não confundir com divergência de OP).
- Justificativas são mantidas em tabela separada e não são removidas quando se substitui a base.
- Atenção: quando duas OPs reivindicam a mesma série/setor, a divergência é exibida, sem inferir qual OP é a correta.

## Limitações conhecidas
- Verificada leitura dos Excel reais no navegador: 53.462 linhas de programação, 51.313 de apontamentos e 3 diferenças de OP entre as bases.
- Verificada sintaxe TS/TSX por transpilação; as dependências npm do ambiente de teste estavam incompletas, impedindo o `npm run check` integral.
- **Sem teste integrado com banco de homologação** e sem medição real de custo; a ausência de regressões em produção não pode ser garantida antecipadamente.
- A nova funcionalidade gera trabalho adicional no Supabase (armazenamento e importações); otimizações ajudam, mas consumo idêntico ao anterior não é garantido.
