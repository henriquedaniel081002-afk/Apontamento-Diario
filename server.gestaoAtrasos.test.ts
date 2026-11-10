// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Pool } from 'pg';
import { registerGestaoAtrasosRoutes } from './server.gestaoAtrasos';

async function setup(perfil:'APONTADOR'|'COORDENACAO'='APONTADOR') {
  const app=express();app.use(express.json());
  const query=vi.fn(async (sql:string, _values?:any[]): Promise<any> => {
    if(sql.includes('AS "apontamentoImportado"'))return {rowCount:1,rows:[{visible:true,series:[],progresso:[],apontamentoImportado:true}]};
    if(sql.includes('page_rows'))return {rows:[{rows:[{op:'12580',setor:'BOBINAGEM',programados:3,produzidos:1,pendentes_vencidos:1}],total:1,kpis:{},importacoes:[]}]};
    if(sql.includes('SELECT tipo,esperado'))return {rows:[]};
    return {rows:[],rowCount:1};
  });
  const connect=vi.fn(async()=>({query,release:vi.fn()}));
  const getAccess=vi.fn(async()=>[{setor:'BOBINAGEM',linha:'TRI'}]);
  const auth=(req:any,_res:any,next:any)=>{req.auth={userId:5,login:'lider',perfil};next();};
  const coord=(req:any,res:any,next:any)=>perfil==='COORDENACAO'?next():res.status(403).json({error:'Coordenação'});
  registerGestaoAtrasosRoutes(app,{query,connect} as unknown as Pool,auth,coord,getAccess);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const port=(server.address() as {port:number}).port;
  const request=async(path:string,init?:RequestInit)=>fetch(`http://127.0.0.1:${port}/api/gestao-atrasos${path}`,{...init,headers:{'Content-Type':'application/json'}});
  return {query,connect,request,close:()=>new Promise<void>(resolve=>server.close(()=>resolve()))};
}

describe('Gestão de atrasos — segurança das rotas',()=>{
  it('aplica setores autorizados no SQL do resumo e pagina no banco',async()=>{
    const t=await setup();try{
      const r=await t.request('/resumo?op=12580&situacao=TODOS');expect(r.status).toBe(200);
      const call=t.query.mock.calls.find(([sql])=>sql.includes('page_rows'))!;
      expect(call[0]).toContain('p.setor=ANY($4::text[])');
      expect(call[0]).toContain('LIMIT 50 OFFSET');expect(call[1][3]).toEqual(['BOBINAGEM']);
      expect((await r.json()).rows).toHaveLength(1);
    }finally{await t.close();}
  });
  it('nega filtro de outro setor antes de consultar o banco',async()=>{
    const t=await setup();try{expect((await t.request('/resumo?setor=SOLDA')).status).toBe(403);expect(t.query).not.toHaveBeenCalled();}finally{await t.close();}
  });
  it('nega leitura de histórico e detalhes de outro setor',async()=>{
    const t=await setup();try{
      expect((await t.request('/justificativas?op=12580&setor=SOLDA')).status).toBe(403);
      expect((await t.request('/op/12580?setor=SOLDA')).status).toBe(403);
      expect(t.query).not.toHaveBeenCalled();
    }finally{await t.close();}
  });
  it('nega escrita em outro setor e aceita observação sem prazo no setor próprio',async()=>{
    const t=await setup();try{
      const body={op:'12580',setor:'SOLDA',motivo:'Problema de material',previsao_regularizacao:'2026-11-02'};
      expect((await t.request('/justificativas',{method:'POST',body:JSON.stringify(body)})).status).toBe(403);
      expect((await t.request('/justificativas',{method:'POST',body:JSON.stringify({...body,setor:'BOBINAGEM',previsao_regularizacao:null})})).status).toBe(200);
      expect(t.query.mock.calls.at(-1)?.[1]?.[3]).toBeNull();
    }finally{await t.close();}
  });
  it('permite progresso agregado de outros setores apenas para OP visível no próprio setor',async()=>{
    const t=await setup();try{
      const r=await t.request('/op/12580?setor=BOBINAGEM');expect(r.status).toBe(200);
      const sql=t.query.mock.calls.map(([text])=>text);
      expect(sql).toHaveLength(1);
      expect(sql[0]).toContain('FROM scoped WHERE setor=$2');
      expect(sql[0]).toContain('FROM scoped GROUP BY setor');
      expect(sql[0]).toContain('EXISTS(SELECT 1 FROM series) visible');
    }finally{await t.close();}
  });
  it('registra motivo e prazo por OP e setor criando histórico sem sobrescrever',async()=>{
    const t=await setup();try{
      t.query.mockImplementation(async(sql:string):Promise<any>=>{
        if(sql.includes('INSERT INTO public.atrasos_justificativas'))return {rowCount:1,rows:[{id:42,criado_em:'2026-10-29T12:00:00Z'}]};
        return {rowCount:0,rows:[]};
      });
      const r=await t.request('/justificativas',{method:'POST',body:JSON.stringify({op:'12580',setor:'BOBINAGEM',motivo:'Material em falta',previsao_regularizacao:'2026-11-02'})});
      expect(r.status).toBe(200);expect((await r.json()).id).toBe(42);
      const sql=t.query.mock.calls.map(([q])=>q).join(' ');
      expect(sql).toContain('INSERT INTO public.atrasos_justificativas');expect(sql).not.toContain('UPDATE public.atrasos_justificativas');
      expect(t.query.mock.calls.at(-1)?.[1]?.slice(0,6)).toEqual(['12580','BOBINAGEM','Material em falta','2026-11-02',5,'lider']);
    }finally{await t.close();}
  });
  it('importação incompleta mantém a anterior ativa e reverte a transação',async()=>{
    const t=await setup('COORDENACAO');try{
      t.query.mockImplementation(async(sql:string)=>{
        if(sql.includes('SELECT esperado'))return {rowCount:1,rows:[{esperado:10}]};
        if(sql.includes('count(*)::int'))return {rows:[{total:9}],rowCount:1};
        return {rows:[],rowCount:1};
      });
      const id='12345678-1234-4123-8123-123456789abc';
      const r=await t.request('/importacoes/finalizar',{method:'POST',body:JSON.stringify({tipo:'PROGRAMACAO',id})});
      expect(r.status).toBe(400);
      const statements=t.query.mock.calls.map(([sql])=>sql);
      expect(statements).toContain('ROLLBACK');
      expect(statements).not.toContainEqual(expect.stringContaining("DELETE FROM public.atrasos_importacoes WHERE tipo=$1 AND status=$2"));
    }finally{await t.close();}
  });
  it('coordenação não recebe filtro por setor na consulta',async()=>{
    const t=await setup('COORDENACAO');try{
      expect((await t.request('/resumo?setor=SOLDA')).status).toBe(200);
      const call=t.query.mock.calls.find(([sql])=>sql.includes('page_rows'))!;
      expect(call[1][3]).toBeNull();
    }finally{await t.close();}
  });
});

describe('Exportação de prioridades — filtros e permissões',()=>{
  it('aplica os filtros e limita as programações até o dia de Manaus, sem paginação',async()=>{
    const t=await setup();try{
      const r=await t.request('/relatorio-prioridades?setor=BOBINAGEM&linha=TRI&op=12580&situacao=TODOS&justificativa=SEM&multiplos=true&inicio=2026-10-01&fim=2026-12-31');
      expect(r.status).toBe(200);
      const [sql,params]=t.query.mock.calls.find(([query])=>query.includes('LIMIT 5001'))!;
      expect(sql).toContain('p.data_programada < $2::date');
      expect(sql).toContain('data_programada,op,setor LIMIT 5001');
      expect(sql).toContain('COUNT(DISTINCT p.serie)::int qtde_total_op');
      expect(params.slice(0,4)).toEqual(['2026-10-01','2027-01-01',expect.any(String),['BOBINAGEM']]);
      expect(params.slice(4)).toEqual(['BOBINAGEM','12580',null,'TRI',null,'SEM',true,false,'TODOS']);
    }finally{await t.close();}
  });
  it('nega exportação de outro setor e situação removida',async()=>{
    const t=await setup();try{
      expect((await t.request('/relatorio-prioridades?setor=SOLDA')).status).toBe(403);
      expect((await t.request('/relatorio-prioridades?situacao=PRAZO_VENCIDO')).status).toBe(400);
      expect(t.query).not.toHaveBeenCalled();
    }finally{await t.close();}
  });
  it('não confunde produção tardia já encerrada com pendência em atraso',async()=>{
    const t=await setup();try{
      const r=await t.request('/resumo?situacao=ATRASADOS');expect(r.status).toBe(200);
      const [sql]=t.query.mock.calls.find(([query])=>query.includes('page_rows'))!;
      expect(sql).toContain("$12='ATRASADOS' AND pendentes_vencidos>0");
      expect(sql).not.toContain("$12='ATRASADOS' AND (pendentes_vencidos>0 OR produzidos_em_atraso>0)");
    }finally{await t.close();}
  });
});
