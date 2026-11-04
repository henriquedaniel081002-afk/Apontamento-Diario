import {pathToFileURL} from 'node:url';
if(!process.env.ITAM_PLAYWRIGHT_MODULE)throw Error('Defina ITAM_PLAYWRIGHT_MODULE para o index.mjs do Playwright instalado separadamente.');
const {chromium}=await import(pathToFileURL(process.env.ITAM_PLAYWRIGHT_MODULE).href);
import * as XLSX from '../../node_modules/xlsx/xlsx.mjs';
import fs from 'node:fs';
const makeFile=(n,tipo)=>{const rows=Array.from({length:n},(_,i)=>({'SERIE':String(700000+i),'OP':String(7000+Math.floor(i/50)),'SETOR':'BOBINAGEM EPOXI','LINHA':'EPO',[tipo==='PROGRAMACAO'?'DATA PROG.':'DATA PRODUZIDA']:'2026-10-15','CLIENTE':'Sintético local','POTENCIA':'45','TURNO':'1'}));const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),tipo==='PROGRAMACAO'?'BASE PROG 2026':'Apontamento Final');return XLSX.write(book,{type:'buffer',bookType:'xlsx',compression:true});};
console.log('Launching Chrome');
const browser=await chromium.launch({executablePath:process.env.ITAM_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
console.log('Chrome ready');
const deadline=setTimeout(()=>{console.error('Browser test timeout');void browser.close();},180000);
const result={method:'Single synthetic real XLSX upload each type; localhost PGlite, no production; 1001 rows -> sequential 1000 + 1 batches. 50000 rows parser only, unchanged parser, no before/after claim.',imports:[],errors:[]};
try{
const context=await browser.newContext({timezoneId:'America/Manaus',locale:'pt-BR'});
await context.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
await context.addInitScript(()=>{localStorage.setItem('itam_current_user_v2',JSON.stringify({id:'local',name:'COORDENAÇÃO',perfil:'COORDENACAO',setor:'SOLDA',linhas:['MON','TRI','EPO']}));localStorage.setItem('itam_auth_token_v1','LOCAL-ONLY-NOT-A-REAL-TOKEN');localStorage.setItem('itam_last_activity_v1',String(Date.now()));});
const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>result.errors.push(e.message));
await page.goto('http://127.0.0.1:4321',{waitUntil:'domcontentloaded',timeout:120000});console.log('Page loaded');await page.getByRole('button',{name:'Atraso',exact:true}).click();await page.getByRole('tab',{name:'Visão OP',exact:true}).click();
await page.getByLabel('Início',{exact:true}).fill('2026-10-01');await page.getByLabel('Fim',{exact:true}).fill('2026-10-31');
await page.locator('.op-import > summary').click();
for(const tipo of ['PROGRAMACAO','APONTAMENTO']){
 console.log('Importing',tipo);
 const buffer=makeFile(1001,tipo);const requests=[];const capture=req=>{if(req.url().includes('/importacoes/'))requests.push({path:new URL(req.url()).pathname,bytes:Buffer.byteLength(req.postData()||''),rows:JSON.parse(req.postData()||'{}').linhas?.length});};page.on('request',capture);
 const finished=page.waitForResponse(r=>r.url().endsWith('/importacoes/finalizar')&&r.status()===200);const start=performance.now();
 await page.getByLabel(tipo==='PROGRAMACAO'?'Programação detalhada':'Apontamento detalhado',{exact:true}).setInputFiles({name:tipo+'.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
 const response=await finished;const body=await response.json();await page.getByText(/1\.001 importados/).waitFor();const ms=performance.now()-start;page.off('request',capture);
 if(body.importados!==1001||requests.filter(r=>r.rows).map(r=>r.rows).join(',')!=='1000,1')throw Error('Import contract '+JSON.stringify({body,requests}));
 result.imports.push({tipo,xlsxBytes:buffer.length,ms,imported:body.importados,requests});
}
console.log('Parsing 50000');const large=makeFile(50000,'PROGRAMACAO');await context.route('**/synthetic-large.xlsx',r=>r.fulfill({body:large,contentType:'application/octet-stream'}));
result.largeParser=await page.evaluate(async()=>{const {readDetailedExcel}=await import('/src/gestao-atrasos/importDetailedExcel.ts');const buffer=await(await fetch('/synthetic-large.xlsx')).arrayBuffer();const start=performance.now();const preview=await readDetailedExcel(new File([buffer],'synthetic.xlsx'),'PROGRAMACAO',undefined,{inicio:'2026-10-01',fim:'2026-11-01'});return {rows:preview.rows.length,ignored:preview.ignored,ms:performance.now()-start,xlsxBytes:buffer.byteLength};});
if(result.largeParser.rows!==50000||result.errors.length)throw Error(JSON.stringify(result));
fs.writeFileSync(new URL('../../homologacao-missao/browser-imports.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{clearTimeout(deadline);await browser.close();}
