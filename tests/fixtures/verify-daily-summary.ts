import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

type Input = Partial<Record<'setor'|'linha'|'cliente'|'op'|'serie'|'inicio'|'fim'|'situacao'|'justificativa'|'multiplos'|'page',string>>;
type Serie = {op:string;setor:string;serie:string;linha:string;cliente:string;dia:string;feita:string|null;observada:boolean};
type Dia = {op:string;setor:string;data_programada:string;programados:number;produzidos:number;pendentes_vencidos:number;observada:boolean};
type Request = (path:string,query?:Input,body?:object,method?:string,params?:object,status?:number)=>Promise<any>;

// Oráculo apenas para as fixtures de outubro dos benchmarks históricos.
// Agrupa em memória, sem reutilizar a consulta ou os indicadores da aplicação.
export async function verifyDailySummary(db:PGlite,request:Request,scenarios:Input[]) {
  const {rows}=await db.query<Serie>(`SELECT p.op,p.setor,p.serie,p.linha,p.cliente,p.data_programada::text dia,
    a.data_produzida::text feita,EXISTS(SELECT 1 FROM atrasos_justificativas j WHERE (j.op,j.setor)=(p.op,p.setor)) observada
    FROM atrasos_programacao_detalhada p LEFT JOIN atrasos_apontamentos_detalhados a ON
      (a.serie,a.setor,a.op)=(p.serie,p.setor,p.op) AND a.importacao_id=(SELECT id FROM atrasos_importacoes WHERE status='ATIVA' AND tipo='APONTAMENTO')
    WHERE p.importacao_id=(SELECT id FROM atrasos_importacoes WHERE status='ATIVA' AND tipo='PROGRAMACAO')`);
  const pending=new Set(rows.filter(r=>!r.feita).map(r=>r.op+'|'+r.setor));
  for(const q of scenarios) {
    if(q.situacao==='PENDENTES'||q.situacao==='PRAZO_VENCIDO'){
      await request('/resumo',q,{},'GET',{},400);
      continue;
    }
    const days=new Map<string,Dia>();
    const datesPerSector=new Map<string,Set<string>>();
    for(const r of rows) {
      if(r.dia<(q.inicio||'2026-09-01')||r.dia>(q.fim||'2026-10-31')||
         (q.setor&&r.setor!==q.setor)||(q.op&&r.op!==q.op)||(q.serie&&r.serie!==q.serie)||
         (q.linha&&r.linha!==q.linha)||(q.cliente&&!r.cliente.includes(q.cliente)))continue;
      const pair=r.op+'|'+r.setor, key=r.dia+'|'+pair;
      if(!datesPerSector.has(pair))datesPerSector.set(pair,new Set());
      datesPerSector.get(pair)!.add(r.dia);
      const day=days.get(key)??{op:r.op,setor:r.setor,data_programada:r.dia,programados:0,produzidos:0,pendentes_vencidos:0,observada:r.observada};
      day.programados++;if(r.feita)day.produzidos++;else if(r.dia<'2026-10-30')day.pendentes_vencidos++;
      days.set(key,day);
    }
    const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
    const keys=[...days.keys()].sort((a,b)=>{
      const x=days.get(a)!,y=days.get(b)!;
      return compare(x.data_programada,y.data_programada)||compare(x.op,y.op)||compare(x.setor,y.setor);
    }).filter(k=>{
      const d=days.get(k)!,pair=d.op+'|'+d.setor;
      return !(q.situacao==='ATRASADOS'&&!d.pendentes_vencidos || q.situacao==='CONCLUIDOS'&&pending.has(pair) ||
        q.justificativa==='COM'&&!d.observada || q.justificativa==='SEM'&&d.observada ||
        q.multiplos==='true'&&datesPerSector.get(pair)!.size<=1);
    });
    const actual=await request('/resumo',q);
    const offset=(Number(q.page||1)-1)*50;
    assert.equal(actual.total,keys.length,JSON.stringify(q));
    const expected=keys.slice(offset,offset+50).map(k=>days.get(k));
    assert.deepEqual(actual.rows.map((d:any)=>({op:d.op,setor:d.setor,data_programada:d.data_programada,
      programados:d.programados,produzidos:d.produzidos,pendentes_vencidos:d.pendentes_vencidos,observada:d.motivo!=null})),expected,JSON.stringify(q));
  }
}

