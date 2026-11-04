# Reprodução local

Os scripts browser são testes de dados sintéticos; não apontar portas/proxy para provedores. Foram usados Node 22.23.4, Chrome local headless, Playwright 1.x instalado separadamente, PGlite 0.5.13. A versão exata do Playwright consta em ambiente.json. Nenhuma dependência de browser foi adicionada ao aplicativo.

1. Extrair original e novo em pastas separadas. Excluir .env reais de ambas e remover variáveis DATABASE/SUPABASE/VITE/SESSION_SECRET/PG* herdadas do terminal. Usar Node 22.x. npm ci em ambas.
2. Na entrega: npm run typecheck; npm run test; npm run build; npm run test:sql; npm run test:neon; npm run test:audit-sql; npm run test:imports; npm run benchmark:productivity. Os scripts SQL não importam server.ts nem dotenv e usam PGlite em memória.
3. Instalar Playwright em pasta de ferramentas separada, com a versão de ambiente.json. Definir ITAM_PLAYWRIGHT_MODULE como caminho absoluto de node_modules/playwright/index.mjs. ITAM_CHROME_PATH pode apontar para Chrome local. Não usar conta/navegador pessoal: os scripts criam contexto temporário.
4. Para visual: na raiz da entrega executar npm run preview:local. Em outro terminal: node evidencias/reproducao/visual-check.mjs. Usa apenas 4320/4321; insere sessão fictícia no contexto do teste. Capturas em evidencias/.
5. Em seguida: node evidencias/reproducao/op-import-check.mjs. Este teste substitui somente as bases sintéticas em memória do mock. A captura visual deve preceder a importação. O ensaio de 50 mil é parsing do parser herdado, sem comparação de ganho.
6. Para navegação comparada: compilar a cópia original (npm run build). Na entrega: npx --no-install tsx scripts/benchmark-http.ts CAMINHO_ABSOLUTO_ORIGINAL. Usa 4340/4341, a mesma fixture sintética em PGlite e builds estáticos de ambas as versões. Em outro terminal: node evidencias/reproducao/benchmark-browser.mjs. Executar isoladamente de outros benchmarks; 13 pares alternados, primeira navegação separada e 12 amostras medidas.
7. Encerrar somente processos iniciados para esses testes. Nenhum script exige banco remoto, SQL de instalação remoto ou credenciais.

run_safe_original.py documenta o runner usado na missão (layout work/baseline e work/optimized e runtime isolado). Ele não é requisito do aplicativo. Os testes produzem novos arquivos de evidências; guardar os resultados originais antes de repetir. Comparações de arquivos/hash da entrega são externas ao ZIP para evitar autorreferência de manifesto.
