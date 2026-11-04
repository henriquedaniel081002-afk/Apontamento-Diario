import ts from 'typescript';
import * as XLSX from 'xlsx';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
function parser(path:string) {
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports:any={};
 new Function('require','exports',code)((name:string)=>{
  if(name==='xlsx')return XLSX;
  if(name.endsWith('/performanceService'))return {measureAsync:(_name:string,fn:()=>any)=>fn()};
  if(name.endsWith('/lib/supabase'))return {supabase:null};
  throw new Error('Unexpected import: '+name);
 },exports);
 return exports.parseProductivityWorkbook;
}
const before=parser('tests/fixtures/audit-productivity-importService.ts'),after=parser('src/productivity/services/importService.ts');
const rows=Array.from({length:10000},(_,i)=>({'DATA':i%2?'01/10/2026':'02/10/2026','MATRÍCULA':String(i%100),'NOME DO COLABORADOR':`Pessoa sintética ${i%100}`,'SETOR':'BOBINAGEM','TURNO':i%2?'2º':'1º','MÁQUINA':'A','DESENHO':'AT','OP':'77','POTÊNCIA':30,'QUANTIDADE PRODUZIDA':'1.234,5','HORA EXTRA (min)':i%2?30:45,'REALIZADO':10,'OBSERVAÇÃO':'Texto sintético'}));
const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'BOBINAGEM (MÁQ)');const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx',compression:true});
const file={name:'produtividade-sintetica-10000.xlsx',arrayBuffer:async()=>bytes} as File;
const expected=await before(file);assert.deepEqual(await after(file),expected);
const measurements:any={original:[],optimized:[]};
for(let i=0;i<13;i++)for(const name of i%2?['optimized','original']:['original','optimized']){
 const cpu=process.cpuUsage(),start=performance.now();const result=await (name==='original'?before:after)(file);const elapsed=performance.now()-start,usage=process.cpuUsage(cpu);
 assert.deepEqual(result,expected);measurements[name].push({ms:elapsed,cpuMs:(usage.user+usage.system)/1000});
}
const report:any={rows:rows.length,xlsxBytes:bytes.byteLength,equivalent:true,remoteCalls:0,note:'Full XLSX parse + conversion; synthetic workbook; alternating order. CPU process, not provider. RAM/CU NOT MEASURED.',node:process.version};
for(const name of ['original','optimized']){const samples=measurements[name].slice(1),sorted=samples.map(x=>x.ms).sort((a,b)=>a-b);report[name]={firstMs:measurements[name][0].ms,p50:sorted[5],p95:sorted[11],cpuMs:samples.reduce((n,x)=>n+x.cpuMs,0),samples};}
mkdirSync('homologacao-missao',{recursive:true});writeFileSync('homologacao-missao/benchmark-productivity-parse.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
