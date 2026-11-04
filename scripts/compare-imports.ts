import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

// Extract only pure import helpers. Never import server.ts, dotenv or pg.
function helpers(path: string) {
  const source=readFileSync(path,'utf8');
  const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
  const functions=new Set(['importUnitKey','prepareImportGroups','mergeApontamentoIntoCanonical','mergeTurnSectorDuplicateGroup','cleanupUnusedImportedProduction','replaceImportedProductionForDate','importedMonthPredicate']);
  const constants=new Set(['IMPORT_FALLBACK_SECTORS','SHARED_IMPORT_SECTORS','TURN_OCCURRENCE_SECTORS']);
  const selected=file.statements.filter(node=>ts.isFunctionDeclaration(node)?functions.has(node.name?.text||''):ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&constants.has(d.name.text)));
  const code=ts.transpileModule(selected.map(n=>n.getText(file)).join('\n'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  return new Function(code+'; return {replaceImportedProductionForDate,cleanupUnusedImportedProduction,month:typeof importedMonthPredicate===\'function\'?importedMonthPredicate:null};')();
}
const original=helpers('tests/fixtures/audit-server-source.txt'),optimized=helpers('server.ts');
const db=new PGlite();
await db.exec(`CREATE TABLE setores(id bigint PRIMARY KEY,nome text);CREATE TABLE linhas(id bigint PRIMARY KEY,nome text);CREATE TABLE usuarios(id bigint PRIMARY KEY,login text);CREATE TABLE usuario_acessos(usuario_id bigint,setor_id bigint,linha_id bigint);
INSERT INTO setores VALUES(1,'SOLDA'),(2,'MPA'),(3,'BOBINA AT/BT'),(4,'BOBINAGEM EPOXI'),(5,'FERRAGEM'),(6,'MONTAGEM FINAL');
INSERT INTO linhas VALUES(1,'MON'),(2,'TRI'),(3,'EPO');INSERT INTO usuarios VALUES(1,'SINTETICO');
INSERT INTO usuario_acessos SELECT 1,s.id,l.id FROM setores s CROSS JOIN linhas l;
CREATE TABLE apontamentos(id bigserial PRIMARY KEY,data date,usuario_id bigint,setor_id bigint,tipo_bobina text,origem_producao text,complementado boolean,turno1_complementado boolean,turno2_complementado boolean,status_aprovacao text DEFAULT 'PENDENTE',aprovado_em timestamp,aprovado_por bigint,atualizado_em timestamp DEFAULT now());
CREATE TABLE producao(id bigserial PRIMARY KEY,apontamento_id bigint REFERENCES apontamentos ON DELETE CASCADE,linha_id bigint,potencia numeric,quantidade int,turno text);`);
const children=['paradas_falta_material','paradas_maquina','nao_conformidades','faltas','observacoes'];
for(const table of children)await db.exec(`CREATE TABLE ${table}(id bigserial PRIMARY KEY,apontamento_id bigint REFERENCES apontamentos ON DELETE CASCADE,descricao text)`);
async function seed() {
 await db.exec(`TRUNCATE apontamentos,producao,${children.join(',')} RESTART IDENTITY CASCADE;
 INSERT INTO apontamentos(data,usuario_id,setor_id,origem_producao,complementado,turno1_complementado,turno2_complementado,status_aprovacao)
 SELECT CASE WHEN n=400 THEN DATE '2026-09-30' ELSE DATE '2026-10-01' END,1,1,'IMPORTADO',CASE WHEN n%5=0 THEN NULL ELSE n%3=0 END,n%7=0,n%11=0,'APROVADO' FROM generate_series(1,400)n;
 INSERT INTO producao(apontamento_id,linha_id,potencia,quantidade,turno) SELECT id,1,30.5,9,'1º' FROM apontamentos;
 INSERT INTO apontamentos(data,usuario_id,setor_id,origem_producao,complementado) VALUES('2026-10-01',1,2,'MANUAL',true);`);
 for(let i=0;i<children.length;i++)await db.query(`INSERT INTO ${children[i]}(apontamento_id,descricao) VALUES($1,'Ocorrência manual preservada')`,[i+1]);
}
let calls=0,sqlBytes=0,parameterBytes=0;
const client={query:async(sql:string,params?:any[])=>{calls++;sqlBytes+=Buffer.byteLength(sql);parameterBytes+=Buffer.byteLength(JSON.stringify(params||[]));const r=await db.query(sql,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};}};
async function snapshot(){const result:any={};for(const t of ['apontamentos','producao',...children])result[t]=(await db.query(`SELECT ${t==='apontamentos'?"id,data,usuario_id,setor_id,tipo_bobina,origem_producao,complementado,turno1_complementado,turno2_complementado,status_aprovacao,aprovado_em,aprovado_por":'*'} FROM ${t} ORDER BY id`)).rows;return result;}
const groups=Array.from({length:1200},(_,i)=>({setor:['MPA','BOBINA AT/BT','BOBINAGEM EPOXI','MONTAGEM FINAL'][i%4],linha:i%4===2?'EPO':i%3===0?'MON':'TRI',potencia:30+(i%20),quantidade:1+(i%3),turno:i%2?'1º':'2º',tipoBobina:i%8<4?'AT':'BT'}));
async function operation(h:any,kind:string){
 await client.query('BEGIN');
 try {
  if(kind==='cleanup')await h.cleanupUnusedImportedProduction(client,'a.data=$1::date',['2026-10-01'],new Set([10]));
  else {await h.replaceImportedProductionForDate(client,'2026-10-01',groups,1);if(kind==='reimport')await h.replaceImportedProductionForDate(client,'2026-10-01',groups,1);}
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e;}
}
for(const kind of ['cleanup','import','reimport']){
 await seed();await operation(original,kind);const expected=await snapshot();
 await seed();await operation(optimized,kind);assert.deepEqual(await snapshot(),expected,kind);
}
// Exercise actual turn-sector merge and all five manual occurrence collections.
for(const h of [original,optimized]){
 await seed();await client.query('BEGIN');
 await h.replaceImportedProductionForDate(client,'2026-10-01',[{setor:'SOLDA',linha:'MON',potencia:30,quantidade:7,turno:'1º'}],1);
 await client.query('COMMIT');
 const state=await snapshot();
 if(h===original)(globalThis as any).expectedMerged=state;else assert.deepEqual(state,(globalThis as any).expectedMerged);
}
await seed();const initial=await snapshot();
await client.query('BEGIN');
await optimized.replaceImportedProductionForDate(client,'2026-10-01',groups,1);
await client.query('ROLLBACK');assert.deepEqual(await snapshot(),initial,'rollback restores every collection');
// A confirmed earlier day survives rollback of a later day.
await operation(optimized,'import');const committed=await snapshot();
await client.query('BEGIN');await optimized.replaceImportedProductionForDate(client,'2026-10-02',groups,1);await client.query('ROLLBACK');assert.deepEqual(await snapshot(),committed);
for(const month of ['2026-01','2026-02','2024-02','2026-12','2027-01','2026-00','2026-13','0000-01']){
 const old=(await db.query("SELECT d::text FROM generate_series(DATE '2024-01-01',DATE '2027-02-01',INTERVAL '1 day') d WHERE TO_CHAR(d,'YYYY-MM')=$1",[month])).rows;
 const query=optimized.month(month).replaceAll('a.data','d');
 const current=(await db.query(`SELECT d::text FROM generate_series(DATE '2024-01-01',DATE '2027-02-01',INTERVAL '1 day') d WHERE ${query}`,[month])).rows;
 assert.deepEqual(current,old,month);
}
const benchmark:any=[];
for(const kind of ['cleanup','import']){
 const metrics:any={original:[],optimized:[]};
 for(let i=0;i<13;i++)for(const name of (i%2?['optimized','original']:['original','optimized'])){
  await seed();calls=0;sqlBytes=0;parameterBytes=0;
  const cpu=process.cpuUsage(),start=performance.now();
  await operation(name==='original'?original:optimized,kind);
  const usage=process.cpuUsage(cpu);
  const sample={ms:performance.now()-start,calls,sqlBytes,parameterBytes,cpuMs:(usage.user+usage.system)/1000};
  metrics[name].push(sample);
 }
 const summary:any={kind};for(const name of ['original','optimized']){const samples=metrics[name].slice(1),sorted=samples.map((x:any)=>x.ms).sort((a:number,b:number)=>a-b);summary[name]={firstSampleMs:metrics[name][0].ms,p50:sorted[5],p95:sorted[11],calls:samples[0].calls,sqlBytes:samples[0].sqlBytes,parameterBytes:samples[0].parameterBytes,cpuMs:samples.reduce((a:number,x:any)=>a+x.cpuMs,0),samples};}
 benchmark.push(summary);
}
mkdirSync('homologacao-missao',{recursive:true});
const report={engine:'PGlite local in memory, synthetic minimal schema; no production connection',checks:['cleanup null/false/true complement flags','all five manual collections','used IDs','month/day boundaries','user/sector/line/AT/BT/shift','reimport','canonical duplicate merge','approval preserved or original merge reset','rollback','earlier committed day preserved','leap month and invalid legacy month'],benchmark};
writeFileSync('homologacao-missao/benchmark-neon-imports.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await db.close();
