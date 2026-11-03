import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileUp, RefreshCw, Search, X } from 'lucide-react';
import { OpDetailModal } from '../gestao-atrasos/OpDetailModal';
import {field,button,fmt,br,situation,type Row,type Series,type Progress,type History,type Summary,type Mismatch} from '../gestao-atrasos/presentation';
import { OpKpis } from '../gestao-atrasos/OpKpis';
import { recordPerformance } from '../services/performanceService';
import type { User } from '../types';
import { apiRequest } from '../services/apiClient';
import { readDetailedExcel, type DetailedTipo, type DetailedRow } from '../gestao-atrasos/importDetailedExcel';

export function GestaoAtrasosPage({user,active}:{user:User;active:boolean}) {
  const emptyFilters={op:'',serie:'',setor:'',linha:'',cliente:'',inicio:'',fim:'',situacao:'ATRASADOS',justificativa:'',multiplos:false};
  const [detailError,setDetailError]=useState('');
  const modalRequest=useRef<AbortController|null>(null);
  const [data,setData]=useState<Summary|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [filters,setFilters]=useState({op:'',serie:'',setor:'',linha:'',cliente:'',inicio:'',fim:'',situacao:'ATRASADOS',justificativa:'',multiplos:false});
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<Row|null>(null);
  const [detail,setDetail]=useState<{series:Series[];progresso:Progress[];apontamentoImportado:boolean}|null>(null);
  const [history,setHistory]=useState<History[]>([]);
  const [motivo,setMotivo]=useState('');const [previsao,setPrevisao]=useState('');
  const [saving,setSaving]=useState(false);const [importing,setImporting]=useState(false);
  const [importStatus,setImportStatus]=useState('');const [mismatch,setMismatch]=useState<Mismatch[]>([]);
  const [authorized,setAuthorized]=useState<string[]>([]);
  const [revision,setRevision]=useState(0);
  const prog=useRef<HTMLInputElement>(null),apont=useRef<HTMLInputElement>(null);
  const update=(key:keyof typeof filters,value:string|boolean)=>{setFilters(old=>({...old,[key]:value}));setPage(1);};
  const load=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);setError('');
    try {
      const q=new URLSearchParams();
      Object.entries(filters).forEach(([k,v])=>{if(v)q.set(k,String(v));});q.set('page',String(page));
      const result=await apiRequest<Summary>(`/api/gestao-atrasos/resumo?${q}`,{signal});
      if(!signal.aborted)setData(result);
    }catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Falha ao carregar OPs.');}
    finally{if(!signal.aborted)setLoading(false);}
  },[filters,page]);
  useEffect(()=>{if(!active)return;const controller=new AbortController();setLoading(true);const timer=setTimeout(()=>void load(controller.signal),250);return()=>{clearTimeout(timer);controller.abort();};},[active,load,revision]);
  useEffect(()=>{if(!active)return;const c=new AbortController();void apiRequest<{setores:string[]}>('/api/gestao-atrasos/permissoes',{signal:c.signal}).then(r=>{if(!c.signal.aborted)setAuthorized(r.setores);}).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'Falha ao verificar setores.');});return()=>c.abort();},[active]);
  useEffect(()=>()=>modalRequest.current?.abort(),[]);
  const close=()=>{if(saving)return;modalRequest.current?.abort();setSelected(null);};
  const open=async(row:Row)=>{
    modalRequest.current?.abort();
    const controller=new AbortController();modalRequest.current=controller;
    setSelected(row);setDetail(null);setDetailError('');setHistory([]);setMotivo('');setPrevisao('');
    const q=new URLSearchParams({setor:row.setor});
    if(data?.periodo.inicio)q.set('inicio',data.periodo.inicio);
    if(data?.periodo.fim)q.set('fim',data.periodo.fim);
    try {
      const [d,h]=await Promise.all([
        apiRequest<{series:Series[];progresso:Progress[];apontamentoImportado:boolean}>(`/api/gestao-atrasos/op/${encodeURIComponent(row.op)}?${q}`,{signal:controller.signal}),
        apiRequest<{rows:History[]}>(`/api/gestao-atrasos/justificativas?op=${encodeURIComponent(row.op)}&setor=${encodeURIComponent(row.setor)}`,{signal:controller.signal}),
      ]);if(!controller.signal.aborted){setDetail(d);setHistory(h.rows);}
    }catch(e){if(!controller.signal.aborted)setDetailError(e instanceof Error?e.message:'Falha ao abrir detalhamento.');}
  };
  const save=async()=>{
    if(!selected||motivo.trim().length<5||!previsao)return;
    setSaving(true);
    try {
      await apiRequest('/api/gestao-atrasos/justificativas',{method:'POST',body:JSON.stringify({op:selected.op,setor:selected.setor,motivo,previsao_regularizacao:previsao,inicio:data?.periodo.inicio,fim:data?.periodo.fim})});
      await open(selected);setRevision(n=>n+1);
    }catch(e){setDetailError(e instanceof Error?e.message:'Falha ao salvar justificativa.');}
    finally{setSaving(false);}
  };
  const importFile=async(file:File|undefined,tipo:DetailedTipo)=>{
    if(!file||importing)return;
    setImporting(true);setError('');setMismatch([]);
    const started=performance.now();
    try {
      if(Boolean(filters.inicio)!==Boolean(filters.fim))throw new Error('Para importar um período personalizado, informe Início e Fim.');
      setImportStatus(`Lendo ${file.name}...`);
      const preview=await readDetailedExcel(file,tipo,n=>setImportStatus(`${fmt(n)} linhas analisadas...`),filters.inicio&&filters.fim?{inicio:filters.inicio,fim:new Date(Date.parse(filters.fim)+86400000).toISOString().slice(0,10)}:undefined);
      const parsed=performance.now();
      recordPerformance(`import:${tipo}:parse_validate`,parsed-started,0,preview.rows.length);
      if(preview.rows.length>200000)throw new Error('Limite de 200.000 registros por importação.');
      const session=await apiRequest<{id:string}>('/api/gestao-atrasos/importacoes/iniciar',{method:'POST',body:JSON.stringify({tipo,esperado:preview.rows.length})},{globalLoading:false});
      const size=1000;
      for(let start=0;start<preview.rows.length;start+=size){
        const linhas:DetailedRow[]=preview.rows.slice(start,start+size);
        await apiRequest('/api/gestao-atrasos/importacoes/lote',{method:'POST',body:JSON.stringify({tipo,id:session.id,linhas})},{globalLoading:false});
        setImportStatus(`Enviados ${fmt(Math.min(start+size,preview.rows.length))} / ${fmt(preview.rows.length)} registros`);
      }
      const finished=await apiRequest<{importados:number;divergencias:Mismatch[];totalDivergencias:number;avisoConferencia:string|null}>('/api/gestao-atrasos/importacoes/finalizar',{method:'POST',body:JSON.stringify({tipo,id:session.id})},{globalLoading:false});
      setMismatch(finished.divergencias);
      setImportStatus(`${fmt(finished.importados)} importados · leitura ${Math.round((parsed-started)/1000)} s · envio e validação ${Math.round((performance.now()-parsed)/1000)} s · total ${Math.round((performance.now()-started)/1000)} s. ${finished.totalDivergencias} divergências. ${finished.avisoConferencia||''}`);
      setRevision(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:'Falha na importação.');setImportStatus('Envio interrompido. Confira a base ativa em Atualizar antes de reenviar; lotes pendentes não substituem a base ativa.');}
    finally{setImporting(false);if(prog.current)prog.current.value='';if(apont.current)apont.current.value='';}
  };
  const rows=data?.rows||[];
  return <main className="app-container app-container--wide space-y-5 py-5">
    <header className="rounded-2xl border border-emerald-400/20 bg-[#0b1710] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">ITAM · Atraso</p><h1 className="mt-1 text-2xl font-bold text-white">Visão OP</h1><p className="text-sm text-slate-400">Pendências e produção por OP, data e setor. Sem datas selecionadas: mês anterior e atual. Datas informadas incluem os dois limites.</p></div><button className={button} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/>Atualizar</button></div>
    </header>
    {user.perfil==='COORDENACAO'&&<section className="rounded-2xl border border-white/10 bg-[#0b1710] p-4"><h2 className="font-bold text-white">Importação detalhada</h2><p className="mt-1 text-xs text-slate-400">A base anterior fica ativa até a validação e substituição completas. Importe programação e apontamento separadamente. A importação usa mês anterior/atual; para outro período preencha Início e Fim antes de importar.</p><div className="mt-3 flex flex-wrap gap-2"><input type="file" accept=".xlsx" ref={prog} className="hidden" aria-label="Programação detalhada" onChange={e=>void importFile(e.target.files?.[0],'PROGRAMACAO')}/><input type="file" accept=".xlsx" ref={apont} className="hidden" aria-label="Apontamento detalhado" onChange={e=>void importFile(e.target.files?.[0],'APONTAMENTO')}/><button className={button} disabled={importing} onClick={()=>prog.current?.click()}><FileUp size={16}/>Programação</button><button className={button} disabled={importing} onClick={()=>apont.current?.click()}><FileUp size={16}/>Apontamento</button></div><div className="mt-2 text-xs text-slate-400">{data?.importacoes.map(i=><span key={i.tipo} className="mr-4">{i.tipo}: {fmt(i.esperado)} linhas</span>)}</div>{importStatus&&<p role="status" className="mt-2 text-sm text-emerald-200">{importStatus}</p>}{mismatch.length>0&&<details className="mt-2 text-xs text-amber-200"><summary><AlertTriangle size={14} className="inline"/> Divergências de OP (até 100 exemplos)</summary>{mismatch.map((m,i)=><p key={i}>{m.serie} · {m.setor} · {m.origem}: {m.op_programacao} / {m.op_apontamento}</p>)}</details>}</section>}
    {data&&!data.importacoes.some(i=>i.tipo==='APONTAMENTO')&&<p role="alert" className="rounded-xl border border-amber-400/30 p-3 text-sm text-amber-200">Não há apontamento detalhado ativo. Os totais produzidos e as pendências não podem ser confirmados até a importação.</p>}
    {error&&<p role="alert" className="rounded-xl border border-rose-400/30 p-3 text-sm text-rose-200">{error}</p>}
    <OpKpis values={data?.kpis} loading={loading}/>
    <section className="rounded-2xl border border-white/10 bg-[#0b1710] p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-slate-400">OP<input className={field} value={filters.op} onChange={e=>update('op',e.target.value)} placeholder="Número da OP"/></label>
      <label className="text-xs text-slate-400">Série<input className={field} value={filters.serie} onChange={e=>update('serie',e.target.value)} placeholder="Série exata"/></label>
      <label className="text-xs text-slate-400">Setor<input list="op-setores" placeholder="Todos os autorizados" className={field} value={filters.setor} onChange={e=>update('setor',e.target.value)}/><datalist id="op-setores">{(user.perfil==='COORDENACAO'?['BOBINA AT','BOBINA BT','SOLDA','MONTAGEM FINAL','CORTE DO LASER','FERRAGEM','MONTAGEM DO NUCLEO','CORTE DO NUCLEO','BOBINAGEM EPOXI','ENCAPSULAMENTO']:authorized).map(s=><option key={s} value={s}/>)}</datalist></label>
      <label className="text-xs text-slate-400">Linha<input className={field} value={filters.linha} onChange={e=>update('linha',e.target.value)} placeholder="MON, TRI, EPO..."/></label>
      <label className="text-xs text-slate-400">Cliente<input className={field} value={filters.cliente} onChange={e=>update('cliente',e.target.value)} placeholder="Nome do cliente"/></label>
      <label className="text-xs text-slate-400">Situação<select className={field} value={filters.situacao} onChange={e=>update('situacao',e.target.value)}><option value="ATRASADOS">Com atraso</option><option value="PENDENTES">Pendência vencida</option><option value="PRAZO_VENCIDO">Prazo vencido</option><option value="CONCLUIDOS">Concluídas</option><option value="TODOS">Todas</option></select></label>
      <label className="text-xs text-slate-400">Justificativa<select className={field} value={filters.justificativa} onChange={e=>update('justificativa',e.target.value)}><option value="">Todas</option><option value="SEM">Sem justificativa</option><option value="COM">Com justificativa</option></select></label>
      <label className="text-xs text-slate-400">Início<input type="date" className={field} value={filters.inicio} onChange={e=>update('inicio',e.target.value)}/></label>
      <label className="text-xs text-slate-400">Fim<input type="date" className={field} value={filters.fim} onChange={e=>update('fim',e.target.value)}/></label>
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-300"><input type="checkbox" checked={filters.multiplos} onChange={e=>update('multiplos',e.target.checked)}/>Programadas em vários dias</label>
    </div><button className={`${button} mt-3`} onClick={()=>{setFilters(emptyFilters);setPage(1);}}>Limpar filtros</button></section>
    <section aria-busy={loading} className="rounded-2xl border border-white/10 bg-[#0b1710] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-white"><Search size={16} className="mr-2 inline"/>Resultados OP + setor: {fmt(data?.total||0)}</h2><span className="text-xs text-slate-400">{loading?'Atualizando...':`Página ${page} · ${rows.length} OP + setor exibidos`}</span></div>
      <div className="space-y-2">{rows.map(r=><button disabled={loading||Boolean(error)} key={`${r.op}|${r.setor}`} onClick={()=>void open(r)} className="w-full rounded-xl border border-white/10 bg-[#101d15] p-3 text-left transition hover:border-emerald-400/40"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-bold text-white">OP {r.op}</span><span className="ml-2 text-sm text-emerald-200">{r.setor}</span><p className="text-xs text-slate-400">{r.cliente||'Cliente não informado'} · {r.linha||'—'} · {r.potencia||'Potência não informada'} · {r.dias_programados} dia(s)</p><p className="text-xs text-slate-300">{br(r.primeira_data_programada)} a {br(r.ultima_data_programada)} · Previsão: {br(r.previsao_regularizacao)}</p></div><div className="text-right text-sm"><strong className={r.pendentes_vencidos?'text-rose-300':'text-emerald-300'}>{fmt(r.pendentes_vencidos)} pendentes vencidos</strong><p className="text-xs text-slate-400">{fmt(r.produzidos_em_atraso)} produzidos após a data · {situation[r.situacao]||r.situacao}</p></div></div><div className="mt-2 flex items-center gap-3 text-xs text-slate-400"><span>{fmt(r.produzidos)} / {fmt(r.programados)} produzidos</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400" style={{width:`${Math.min(100,100*r.produzidos/Math.max(1,r.programados))}%`}}/></div><span>{Math.round(100*r.produzidos/Math.max(1,r.programados))}%</span></div></button>)}{!loading&&!rows.length&&<p className="py-6 text-center text-sm text-slate-400">Nenhum registro neste filtro. Confira as importações ou amplie a situação.</p>}</div>
      <div className="mt-4 flex justify-end gap-2"><button className={button} disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><button className={button} disabled={loading||page*50>=(data?.total||0)} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
    </section>
    {selected&&<OpDetailModal key={`${selected.op}|${selected.setor}`} {...{selected,detail,history,detailError,motivo,previsao,saving,close,open,save,setMotivo,setPrevisao}}/>}
  </main>;
}
