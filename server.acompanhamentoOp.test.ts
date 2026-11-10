// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { PGlite } from '@electric-sql/pglite';
import { registerGestaoAtrasosRoutes } from './server.gestaoAtrasos';

describe('Visão OP sobre PostgreSQL local',()=>{
  const db=new PGlite();
  let server:Server;
  let url:string;
  let queries=0;
  const prog='11111111-1111-4111-8111-111111111111';
  const done='22222222-2222-4222-8222-222222222222';
  const start='inicio=2026-11-01&fim=2026-11-30';
  async function api(path:string,body?:Record<string,unknown>,profile='lider',status=200){
    const response=await fetch(url+path,{method:body?'POST':'GET',headers:{'content-type':'application/json','x-fixture-profile':profile},body:body?JSON.stringify(body):undefined});
    const value=await response.json();
    expect(response.status,JSON.stringify(value)).toBe(status);
    return value;
  }
  beforeAll(async()=>{
    vi.useFakeTimers({toFake:['Date']});
    // 10/11 UTC, ainda 09/11 em Manaus.
    vi.setSystemTime(new Date('2026-11-10T02:30:00Z'));
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated');
    await db.exec(readFileSync('SUPABASE_GESTAO_ATRASOS.sql','utf8'));
    await db.query("INSERT INTO atrasos_importacoes(id,tipo,status,esperado) VALUES ($1,'PROGRAMACAO','ATIVA',9),($2,'APONTAMENTO','ATIVA',3)",[prog,done]);
    const rows=[
      ['1','A','42','2026-11-01','TRI','Cliente A','10','REF-A'],
      ['2','A','42','2026-11-01','MON','Cliente B','15','REF-B'],
      ['3','A','42','2026-11-09','TRI','Cliente A','10','REF-A'],
      ['4','A','42','2026-11-30','TRI','Cliente A','10','REF-A'],
      ['1','B','42','2026-10-01','TRI','Reservado','10','REF-B'],
      ['5','A','42','2026-12-01','TRI','Cliente A','10','REF-A'],
      ['2','A','43','2026-11-02','TRI','Cliente A','10','REF-A'],
      ['6','A','44','2026-11-09','TRI','Cliente A','10','REF-A'],
      ['7','A','45','2026-11-08','TRI','Cliente A','10','REF-A'],
    ];
    for(const row of rows) await db.query('INSERT INTO atrasos_programacao_detalhada VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[prog,...row]);
    for(const [serie,setor,op,date] of [['1','A','42','2026-11-06'],['1','B','42','2026-11-01'],['7','A','45','2026-11-09'],['6','A','44','2026-11-09']]){
      await db.query('INSERT INTO atrasos_apontamentos_detalhados(importacao_id,serie,setor,op,data_produzida) VALUES ($1,$2,$3,$4,$5)',[done,serie,setor,op,date]);
    }
    const query=async(sql:string,params?:unknown[])=>{queries++;const r=await db.query(sql,params);return {...r,rowCount:r.rows.length||r.affectedRows};};
    const pool={query,connect:async()=>({query,release(){}})};
    const app=express();app.use(express.json());
    const auth=(req:any,_res:any,next:any)=>{const profile=req.headers['x-fixture-profile'];req.auth={userId:profile==='nenhum'?2:1,login:'Teste',perfil:profile==='coord'?'COORDENACAO':'APONTADOR'};next();};
    const coord=(req:any,res:any,next:any)=>req.auth.perfil==='COORDENACAO'?next():res.sendStatus(403);
    registerGestaoAtrasosRoutes(app,pool as any,auth,coord,async id=>id===1?[{setor:'A'}]:[]);
    server=app.listen(0,'127.0.0.1');
    await new Promise<void>(resolve=>server.once('listening',resolve));
    url='http://127.0.0.1:'+(server.address() as AddressInfo).port+'/api/gestao-atrasos';
  },30000);
  afterAll(async()=>{vi.useRealTimers();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();});

  it('Todos inclui extremos, hoje, futuras e concluídas com contagens diárias e variações dos atributos',async()=>{
    const initial=queries;
    const result=await api('/resumo?'+start);
    expect(queries-initial).toBe(1);
    expect(result.periodo).toEqual({inicio:'2026-11-01',fim:'2026-11-30',hoje:'2026-11-09'});
    expect(result.total).toBe(6);
    const groups=result.rows.filter((r:any)=>r.op==='42');
    expect(groups.map((r:any)=>[r.data_programada,r.programados,r.produzidos,r.qtde_total_op])).toEqual([
      ['2026-11-01',2,1,5],['2026-11-09',1,0,5],['2026-11-30',1,0,5]]);
    expect(groups[0]).toMatchObject({referencia:'REF-A / REF-B',linha:'MON / TRI',cliente:'Cliente A / Cliente B',potencia:'10 / 15',produzidos_em_atraso:1});
    expect(result.kpis.ops_atrasadas).toBe(2);
    const empty=await api('/resumo?'+start+'&page=2');
    expect(empty.rows).toEqual([]);expect(empty.total).toBe(result.total);expect(empty.kpis).toEqual(result.kpis);
    await api('/resumo?inicio=2026-11-10&fim=2026-11-09',undefined,'lider',400);
  });
  it('Atrasos exige pendência anterior, e preserva série em OPs e setores distintos',async()=>{
    const result=await api('/resumo?'+start+'&situacao=ATRASADOS');
    expect(result.rows.map((r:any)=>[r.op,r.data_programada,r.pendentes_vencidos])).toEqual([['42','2026-11-01',1],['43','2026-11-02',1]]);
    const query='setor=A&inicio=2026-11-01&fim=2026-11-01';
    const detail=await api('/op/42?'+query);
    expect(detail.series.map((r:any)=>[r.serie,r.data_produzida,r.situacao])).toEqual([['1','2026-11-06','PRODUZIDO_ATRASADO'],['2',null,'PENDENTE_VENCIDO']]);
    expect(detail.progresso.map((r:any)=>[r.setor,r.programados,r.produzidos,r.quantidade_op])).toEqual([['A',5,1,5],['B',1,1,5]]);
    expect((await api('/op/42?setor=A&inicio=2026-11-30&fim=2026-11-30')).progresso).toEqual(detail.progresso);
    expect((await api('/resumo?'+start+'&serie=2')).rows.map((r:any)=>r.op)).toEqual(['42','43']);
  });
  it('observação aceita prazo opcional, rejeita dados inválidos e mantém histórico por OP/setor',async()=>{
    const note={op:'42',setor:'A',motivo:'Observação antiga',inicio:'2026-11-01',fim:'2026-11-01'};
    await api('/justificativas',{...note,previsao_regularizacao:'2026-11-13'});
    await api('/justificativas',{...note,previsao_regularizacao:'2026-02-30'},'lider',400);
    await api('/justificativas',{...note,motivo:'  '},'lider',400);
    await api('/justificativas',{...note,motivo:{texto:'Objeto'}},'lider',400);
    await api('/justificativas',{...note,motivo:'Observação atual'});
    const history=await api('/justificativas?op=42&setor=A');
    expect(history.rows.map((r:any)=>[r.motivo,r.previsao_regularizacao,r.responsavel])).toEqual([['Observação atual',null,'Teste'],['Observação antiga','2026-11-13','Teste']]);
    expect(history.rows.every((r:any)=>r.criado_em)).toBe(true);
    const view=await api('/resumo?'+start+'&setor=A&linha=TRI&op=42&cliente=Cliente+A&justificativa=COM&multiplos=true');
    expect(view.total).toBe(3);expect(view.rows.every((r:any)=>r.motivo==='Observação atual'&&r.previsao_regularizacao===null)).toBe(true);
    expect((await api('/resumo?'+start+'&setor=A&linha=TRI&op=42&serie=1&cliente=Cliente+A&justificativa=COM&multiplos=true')).total).toBe(0);
    const other=await api('/resumo?inicio=2026-10-01&fim=2026-10-01&setor=B',undefined,'coord');
    expect(other.rows[0]).toMatchObject({op:'42',setor:'B',motivo:null,produzidos:1});
  });
  it('mantém setores autorizados em opções, histórico, detalhe, PDF e gravação',async()=>{
    expect((await api('/filtros?'+start)).combinacoes.every((r:any)=>r.setor==='A')).toBe(true);
    for(const path of ['/op/42?setor=B','/justificativas?setor=B&op=42','/resumo?setor=B','/relatorio-prioridades?setor=B'])await api(path,undefined,'lider',403);
    await api('/justificativas',{op:'42',setor:'B',motivo:'Texto teste'},'lider',403);
    for(const path of ['/resumo','/relatorio-prioridades'])expect((await api(path,undefined,'nenhum')).rows).toEqual([]);
    expect((await api('/filtros',undefined,'nenhum')).combinacoes).toEqual([]);
    await api('/justificativas',{op:'42',setor:'A',motivo:'Texto teste'},'nenhum',403);
  });
  it('relatório retorna anteriores pendentes e adiciona todo o dia quando solicitado',async()=>{
    for(const status of ['TODOS','ATRASADOS']){
      const path='/relatorio-prioridades?'+start+'&situacao='+status;
      const earlier=await api(path);
      expect(earlier.rows.map((r:any)=>r.op)).toEqual(['42','43']);
      const full=await api(path+'&incluirHoje=true');
      expect(full.rows.map((r:any)=>[r.op,r.data_programada])).toEqual([['42','2026-11-01'],['43','2026-11-02'],['42','2026-11-09'],['44','2026-11-09']]);
      expect(full.rows[0]).toMatchObject({programada:2,produzida:1,pendente:1,referencia:'REF-A / REF-B',qtde_total_op:5});
    }
    expect((await api('/relatorio-prioridades?'+start+'&op=42&serie=3&linha=TRI&cliente=Cliente+A&incluirHoje=true')).rows).toHaveLength(1);
  });
  it('exclui importações pendentes e mantém a base anterior após falha de lote e finalização incompleta',async()=>{
    const session=await api('/importacoes/iniciar',{tipo:'PROGRAMACAO',esperado:2},'coord');
    const line={serie:'999',setor:'A',op:'999',data_programada:'2026-11-04',linha:'TRI'};
    const batch={id:session.id,tipo:'PROGRAMACAO',linhas:[line]};
    await api('/importacoes/lote',batch,'coord');await api('/importacoes/lote',batch,'coord');
    await api('/importacoes/lote',{...batch,linhas:[{...line,linha:'MON'},{...line,serie:'998'}]},'coord',400);
    await api('/importacoes/finalizar',{id:session.id,tipo:'PROGRAMACAO'},'coord',400);
    expect((await api('/resumo?'+start+'&op=999')).total).toBe(0);
    expect((await api('/resumo?'+start+'&op=42')).total).toBe(3);
    expect((await db.query('SELECT count(*)::int AS n FROM atrasos_programacao_detalhada WHERE importacao_id=$1',[session.id])).rows).toEqual([{n:1}]);
  });
  it('pagina sem repetir grupos e exige refinar o PDF acima de 5.000 linhas',async()=>{
    await db.query(`INSERT INTO atrasos_programacao_detalhada(importacao_id,serie,setor,op,data_programada,linha)
      SELECT $1::uuid,n::text,'C',n::text,'2026-11-05','TRI' FROM generate_series(80000,85000) n`,[prog]);
    try {
      const path='/resumo?'+start+'&setor=C';
      const a=await api(path,undefined,'coord'),b=await api(path+'&page=2',undefined,'coord');
      expect(a.total).toBe(5001);expect(b.total).toBe(5001);expect(a.rows).toHaveLength(50);
      expect(b.rows).toHaveLength(50);expect(a.rows.at(-1).op).toBe('80049');expect(b.rows[0].op).toBe('80050');
      expect(b.kpis).toEqual(a.kpis);
      await api('/relatorio-prioridades?'+start+'&setor=C',undefined,'coord',413);
    } finally {
      await db.query("DELETE FROM atrasos_programacao_detalhada WHERE importacao_id=$1 AND setor='C'",[prog]);
    }
  },30000);
  it('sem apontamento ativo conserva programação e oculta produtividade desconhecida',async()=>{
    await db.query("UPDATE atrasos_importacoes SET status='PENDENTE' WHERE id=$1",[done]);
    try {
      const r=await api('/resumo?'+start);
      expect(r.total).toBe(6);expect(r.kpis).toBeNull();
      expect(r.rows.every((x:any)=>x.produzidos===null&&x.situacao==='SEM_APONTAMENTO')).toBe(true);
      expect((await api('/resumo?'+start+'&situacao=ATRASADOS')).rows).toEqual([]);
      expect((await api('/relatorio-prioridades?'+start+'&incluirHoje=true')).rows).toEqual([]);
      const detail=await api('/op/42?setor=A&'+start);
      expect(detail.apontamentoImportado).toBe(false);
      expect(detail.progresso.every((p:any)=>p.produzidos===null&&p.pendentes_vencidos===null)).toBe(true);
      expect(detail.series.every((s:any)=>s.situacao==='SEM_APONTAMENTO')).toBe(true);
    }finally{await db.query("UPDATE atrasos_importacoes SET status='ATIVA' WHERE id=$1",[done]);}
  });
});
