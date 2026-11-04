import express from 'express';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { registerGestaoAtrasosRoutes as original } from '../tests/fixtures/audit-gestaoAtrasos.ts';
import path from 'node:path';
import { existsSync } from 'node:fs';
import {registerGestaoAtrasosRoutes} from '../server.gestaoAtrasos.ts';
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

await db.exec(`INSERT INTO atrasos_programacao_detalhada(importacao_id,serie,setor,op,data_programada,linha,cliente,potencia) VALUES
 ('${prog}','990001','BOBINAGEM EPOXI','9001','2026-10-15','EPO','Cliente local Epóxi','45'),
 ('${prog}','990002','ENCAPSULAMENTO','9001','2026-10-16','EPO','Cliente local Epóxi','45');`);
const pool:any={query:async(sql:string,params?:any[])=>{const r=await db.query(sql,params);return {...r,rowCount:r.rows.length||r.affectedRows||0};},connect:async()=>({...pool,release(){}})};
const baselineDir=process.argv[2];
if(!baselineDir||!existsSync(path.resolve(baselineDir,'dist/index.html')))throw Error('Informe o diretório da cópia original já compilada; uso: tsx scripts/benchmark-http.ts CAMINHO_BASELINE');
for(const [port,register,root] of [[4340,original,baselineDir],[4341,registerGestaoAtrasosRoutes,'.']] as const){
 const app=express();app.use(express.json({limit:'5mb'}));
 const auth=(req:any,_res:any,next:any)=>{req.auth={userId:1,login:'LOCAL',perfil:'COORDENACAO'};next();};
 register(app,pool,auth,auth,async()=>[]);
 app.get('/api/coordenacao/apontamentos',(_req,res)=>res.json([]));
 app.get('/api/coordenacao/pendencias-aprovacao',(_req,res)=>res.json({total:0,totalOcorrencias:0,totalFiltrado:0,pagina:1,tamanhoPagina:20,setores:[],registros:[]}));
 app.get('/api/coordenacao/controle-atrasos',(_req,res)=>res.json({rows:[]}));
 app.use(express.static(path.resolve(root,'dist')));
 app.listen(port,'127.0.0.1',()=>console.log(`Comparação LOCAL: http://127.0.0.1:${port}`));
}
