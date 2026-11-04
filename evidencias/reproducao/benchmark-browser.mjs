import {pathToFileURL} from 'node:url';
if(!process.env.ITAM_PLAYWRIGHT_MODULE)throw Error('Defina ITAM_PLAYWRIGHT_MODULE para o index.mjs do Playwright instalado separadamente.');
const {chromium}=await import(pathToFileURL(process.env.ITAM_PLAYWRIGHT_MODULE).href);
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.ITAM_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const samples={original:[],optimized:[]};const pages={};const errors=[];
try {
for(const [name,port] of [['original',4340],['optimized',4341]]){
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR',timezoneId:'America/Manaus'});
 await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 await context.addInitScript(()=>{localStorage.setItem('itam_current_user_v2',JSON.stringify({id:'local',name:'COORDENAÇÃO',perfil:'COORDENACAO',setor:'SOLDA',linhas:['MON','TRI','EPO']}));localStorage.setItem('itam_auth_token_v1','LOCAL-ONLY-NOT-A-REAL-TOKEN');localStorage.setItem('itam_last_activity_v1',String(Date.now()));});
 const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push({name,error:e.message}));pages[name]={page,port};
}
for(let i=0;i<13;i++)for(const name of i%2?['optimized','original']:['original','optimized']){
 const {page,port}=pages[name];await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle'});
 const responses=[];const capture=r=>{if(r.url().includes('/api/gestao-atrasos/'))responses.push(r);};page.on('response',capture);
 const start=performance.now();const loaded=page.waitForResponse(r=>r.url().includes('/resumo?')&&r.status()===200);
 await page.getByRole('button',{name:'Atraso',exact:true}).click();await page.getByRole('tab',{name:'Visão OP',exact:true}).click();await loaded;
 await page.getByRole('button',{name:/OP \d+/}).first().waitFor();
 await page.waitForFunction(()=>!document.body.innerText.includes('Atualizando...'));
 if(name==='optimized')await page.waitForFunction(()=>document.querySelector('#op-setor')&&!document.querySelector('#op-setor').disabled);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const ms=performance.now()-start;page.off('response',capture);
 let bytes=0;for(const response of responses)bytes+=(await response.body().catch(()=>Buffer.alloc(0))).length;
 samples[name].push({ms,httpRequests:responses.length,decodedApiBodyBytes:bytes});
 if(i===0&&name==='original')await page.screenshot({path:new URL('../visao-op-original-desktop.png',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),fullPage:true});
 console.log(name,i,Math.round(ms));
}
const percentile=(a,p)=>a.toSorted((a,b)=>a-b)[Math.ceil(a.length*p)-1];
const result={method:'Node22 Chrome headless; compiled builds; synthetic PGlite, same fixture; 13 alternating pairs; first navigation reported separately, 12 measured; reload outside measured interval; coord default period; localhost only; elapsed click Atraso -> OP rendered; not provider cold start',errors,samples,summary:{}};
for(const name of Object.keys(samples)){const ms=samples[name].slice(1).map(s=>s.ms);result.summary[name]={firstNavigationMs:samples[name][0].ms,p50Ms:percentile(ms,.5),p95Ms:percentile(ms,.95),apiRequests:samples[name][1].httpRequests,decodedApiBodyBytes:samples[name][1].decodedApiBodyBytes};}
fs.writeFileSync(new URL('../../homologacao-missao/benchmark-browser.json',import.meta.url),JSON.stringify(result,null,2));if(errors.length)throw Error(JSON.stringify(errors));
}finally{await browser.close();}
