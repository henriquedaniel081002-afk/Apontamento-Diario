import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { registerGestaoAtrasosRoutes as original } from '../tests/fixtures/original-gestaoAtrasos.ts';
import { registerGestaoAtrasosRoutes as optimized } from '../server.gestaoAtrasos.ts';
import assert from 'node:assert/strict';
mkdirSync('homologacao-local',{recursive:true});
const NativeDate=Date;
// Fixed reference date keeps canonical comparisons reproducible outside October 2026.
globalThis.Date=class extends NativeDate {constructor(...args:any[]){super(...(args.length?args:['2026-10-30T16:00:00Z']) as [any]);}static now(){return new NativeDate('2026-10-30T16:00:00Z').getTime();}} as DateConstructor;
const db=new PGlite();
await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
await db.exec(readFileSync('SUPABASE_GESTAO_ATRASOS.sql','utf8'));
const prog='11111111-1111-4111-8111-111111111111',done='22222222-2222-4222-8222-222222222222';
await db.query("INSERT INTO atrasos_importacoes(id,tipo,status,esperado) VALUES ($1,'PROGRAMACAO','ATIVA',53462),($2,'APONTAMENTO','ATIVA',52797)",[prog,done]);
await db.exec(`INSERT INTO atrasos_programacao_detalhada(importacao_id,serie,setor,op,data_programada,linha,cliente,potencia)
 SELECT '${prog}', n::text, CASE WHEN n%2=0 THEN 'BOBINAGEM' ELSE 'SOLDA' END, (1000+n/80)::text,
 DATE '2026-09-01'+(n%60)::int, CASE WHEN n%3=0 THEN 'MON' ELSE 'TRI' END, 'Cliente '||(n%7), '30' FROM generate_series(1,53462) n;
 INSERT INTO atrasos_apontamentos_detalhados(importacao_id,serie,setor,op,data_produzida)
 SELECT '${done}', serie,setor,op,data_programada+(serie::int%5)-1 FROM atrasos_programacao_detalhada WHERE serie::int%4<>0;
 INSERT INTO atrasos_programacao_detalhada(importacao_id,serie,setor,op,data_programada,linha,cliente,potencia) VALUES
 ('${prog}','1','SOLDA','999','2026-08-15','TRI','Conflito anterior','30'),
 ('${prog}','2','BOBINAGEM','9999','2026-09-03','TRI','Empate perdedor','30'),
 ('${prog}','2','SOLDA','1000','2026-09-05','TRI','Outro setor','30'),
 ('${prog}','900001','BOBINAGEM','8000','2026-07-01','TRI','Historico','30'),
 ('${prog}','900002','BOBINAGEM','8001','2026-11-01','MON','Futuro','30');
 INSERT INTO atrasos_justificativas(op,setor,motivo,previsao_regularizacao,usuario_id,usuario_login) VALUES
 ('1000','BOBINAGEM','Justificativa antiga','2026-09-01',1,'mascarado'),
 ('1000','BOBINAGEM','Justificativa atual','2026-10-01',1,'mascarado'),
 ('1002','SOLDA','Prazo futuro','2026-12-01',1,'mascarado');
 ANALYZE;`);
let calls=0;let captured:any[]=[];
const pool:any={query:async(sql,params)=>{calls++;captured.push({sql,params});const r=await db.query(sql,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};},connect:async()=>({...pool,release(){}})};
function router(register,perfil='COORDENACAO') {
 const routes=new Map();const app:any={get:(path,...handlers)=>routes.set('GET '+path,handlers.at(-1)),post:(path,...handlers)=>routes.set('POST '+path,handlers.at(-1))};
 register(app,pool,()=>{},()=>{},async()=>[{setor:'BOBINAGEM'}]);
 return async(path,query={},body={},method='GET',params={},expectedStatus=200)=>{let status=200,value;await routes.get(method+' /api/gestao-atrasos'+path)({query,body,params,auth:{perfil,userId:1,login:'mascarado'}},{status(n){status=n;return this;},json(x){value=x;return this;}});assert.equal(status,expectedStatus,JSON.stringify(value));return value;};
}
const before=router(original),after=router(optimized);
function normalize(rows){return rows.map(({total,...r})=>({...r,criado_em:r.criado_em?new Date(r.criado_em).toISOString():null,ultima_producao:r.ultima_producao?String(r.ultima_producao instanceof Date?r.ultima_producao.toISOString():r.ultima_producao).slice(0,10):null}));}
const scenarios=[{}, {situacao:'TODOS'},{setor:'BOBINAGEM'},{op:'1000',situacao:'TODOS'},{serie:'1',situacao:'TODOS'}, {serie:'2',situacao:'TODOS'}, {linha:'MON'}, {cliente:'Cliente 3'}, {situacao:'PENDENTES'}, {situacao:'CONCLUIDOS'}, {justificativa:'COM'}, {justificativa:'SEM'}, {multiplos:'true'}, {situacao:'PRAZO_VENCIDO'}, {inicio:'2026-09-12',fim:'2026-10-20'}, {situacao:'TODOS',page:'3'}];
for(const q of scenarios){const a=await before('/resumo',q),b=await after('/resumo',q);assert.deepEqual(normalize(b.rows),normalize(a.rows),JSON.stringify(q));assert.equal(b.total,a.total);}
const empty=await after('/resumo',{situacao:'TODOS',page:'999'});assert(empty.total>0);assert.equal(empty.rows.length,0);assert.equal(empty.kpis.ops_atrasadas,(await after('/resumo',{situacao:'TODOS'})).kpis.ops_atrasadas);
const historical=await after('/resumo',{inicio:'2026-07-01',fim:'2026-07-31',situacao:'TODOS'});assert.equal(historical.rows[0].op,'8000');
const future=await after('/resumo',{inicio:'2026-11-01',fim:'2026-11-30',situacao:'TODOS'});assert.equal(future.rows[0].op,'8001');
for(const register of [original,optimized]) {const leader=router(register,'APONTADOR');const summary=await leader('/resumo',{situacao:'TODOS'});assert(summary.rows.every(r=>r.setor==='BOBINAGEM'));}
const oldDetail=await before('/op/:op',{setor:'BOBINAGEM'},{},'GET',{op:'1000'});const newDetail=await after('/op/:op',{setor:'BOBINAGEM'},{},'GET',{op:'1000'});assert.deepEqual(newDetail,oldDetail);
console.log('Equivalência, períodos, perfis e detalhes: aprovados. Iniciando benchmark local.');
const scenarioResults=[];
for(const q of [{situacao:'TODOS'},{setor:'BOBINAGEM',cliente:'Cliente 2',situacao:'TODOS'},{serie:'2',situacao:'TODOS'}]) {
 const item:any={query:q};
 const runners={original:before,optimized:after};
 const measurements:any={original:{times:[],cpuMs:0,sqlCalls:0,responseBytes:0},optimized:{times:[],cpuMs:0,sqlCalls:0,responseBytes:0}};
 for(const name of ['original','optimized'] as const) {
  captured=[];await runners[name]('/resumo',q);
  const summaryQuery=captured[0];
  const plan=await db.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+summaryQuery.sql,summaryQuery.params);
  writeFileSync(`homologacao-local/plan-${scenarioResults.length}-${name}.json`,JSON.stringify(plan.rows,null,2));
  writeFileSync(`homologacao-local/query-${scenarioResults.length}-${name}.sql`,summaryQuery.sql);
 }
 // Paired samples alternate order to reduce bias from changing host load/cache warmth.
 for(let i=0;i<12;i++)for(const name of (i%2?['optimized','original']:['original','optimized']) as Array<keyof typeof runners>) {
  calls=0;captured=[];const cpu=process.cpuUsage(),t=performance.now();
  const result=await runners[name]('/resumo',q);const elapsed=performance.now()-t,usage=process.cpuUsage(cpu),m=measurements[name];
  m.times.push(elapsed);m.cpuMs+=(usage.user+usage.system)/1000;m.sqlCalls+=calls;m.responseBytes=Buffer.byteLength(JSON.stringify(result));
 }
 for(const name of ['original','optimized']) {
  const m=measurements[name];m.times.sort((a,b)=>a-b);
  item[name]={p50:m.times[5],p95:m.times[11],sqlCalls:m.sqlCalls/12,responseBytes:m.responseBytes,cpuMs:m.cpuMs};
 }
 scenarioResults.push(item);
}
// Transactional staging and safe replay, using real PostgreSQL semantics.
const session=await after('/importacoes/iniciar',{}, {tipo:'PROGRAMACAO',esperado:2},'POST');
const batch={tipo:'PROGRAMACAO',id:session.id,linhas:[{serie:'321',setor:'BOBINAGEM',op:'77',data_programada:'2026-10-01',linha:'TRI'}]};
await after('/importacoes/lote',{},batch,'POST');await after('/importacoes/lote',{},batch,'POST');
assert.equal((await db.query<{n:number}>('SELECT count(*)::int n FROM atrasos_programacao_detalhada WHERE importacao_id=$1',[session.id])).rows[0].n,1);
const beforeActive=await db.query("SELECT id FROM atrasos_importacoes WHERE tipo='PROGRAMACAO' AND status='ATIVA'");
await after('/importacoes/finalizar',{}, {tipo:'PROGRAMACAO',id:session.id},'POST',{},400);
assert.deepEqual((await db.query("SELECT id FROM atrasos_importacoes WHERE tipo='PROGRAMACAO' AND status='ATIVA'")).rows,beforeActive.rows);
await after('/importacoes/lote',{}, {...batch,linhas:[{...batch.linhas[0],linha:'MON'},{...batch.linhas[0],serie:'322'}]},'POST',{},400);
assert.equal((await db.query<{n:number}>('SELECT count(*)::int n FROM atrasos_programacao_detalhada WHERE importacao_id=$1',[session.id])).rows[0].n,1);
await after('/importacoes/lote',{}, {...batch,linhas:[{...batch.linhas[0],serie:'322'}]},'POST');
await after('/importacoes/finalizar',{}, {tipo:'PROGRAMACAO',id:session.id},'POST');
assert.equal((await after('/importacoes/finalizar',{}, {tipo:'PROGRAMACAO',id:session.id},'POST')).repetida,true);
for(const esperado of [0,200001,2000000000])await after('/importacoes/iniciar',{}, {tipo:'PROGRAMACAO',esperado},'POST',{},400);

const report={engine:'PGlite PostgreSQL local WASM; no cloud connections',version:(await db.query('SELECT version()')).rows[0],equivalenceScenarios:scenarios.length,checks:['empty page preserves total/KPIs','custom historical/future dates','authorized sector','detail parity','identical replay no extra rows','transactional finalize','incomplete import preserves active','changed retry rolls back entire batch','repeated finalize is idempotent','API quantity limits before SQL'],scenarioResults};
writeFileSync('homologacao-local/benchmark-sql.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await db.close();globalThis.Date=NativeDate;

