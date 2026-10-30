import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, FileUp, RefreshCw, Search, X } from 'lucide-react';
import type { User } from '../types';
import { apiRequest } from '../services/apiClient';
import { readDetailedExcel, type DetailedTipo, type DetailedRow } from '../gestao-atrasos/importDetailedExcel';

type Row = {
  op:string;setor:string;linha:string;cliente:string;potencia:string;programados:number;produzidos:number;
  pendentes_vencidos:number;produzidos_em_atraso:number;dias_programados:number;primeira_data_programada:string;
  ultima_data_programada:string;motivo:string|null;previsao_regularizacao:string|null;responsavel:string|null;
  criado_em:string|null;situacao:string;
};
type Series = {serie:string;data_programada:string;data_produzida:string|null;situacao:string};
type Progress = {setor:string;programados:number;produzidos:number;pendentes_vencidos:number;quantidade_op:number};
type History = {id:number;motivo:string;previsao_regularizacao:string|null;criado_em:string;responsavel:string};
type Summary = {periodo:{inicio:string;fimExclusivo:string;hoje:string};rows:Row[];total:number;page:number;importacoes:{tipo:DetailedTipo;esperado:number;atualizado_em:string}[]};
type Mismatch = {serie:string;setor:string;op_programacao:string;op_apontamento:string;origem:string};
const field='w-full rounded-xl border border-white/15 bg-[#111f18] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';
const button='inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50';
const fmt=(n:number)=>Number(n||0).toLocaleString('pt-BR');
const br=(v:string|null|undefined)=>v&&/^\d{4}-\d{2}-\d{2}/.test(v)?`${v.slice(8,10)}/${v.slice(5,7)}/${v.slice(0,4)}`:'—';
const situation:Record<string,string>={SEM_JUSTIFICATIVA:'Sem justificativa',SEM_PRAZO:'Sem prazo',JUSTIFICADO:'Justificado',PRAZO_VENCIDO:'Prazo vencido',REGULARIZADO:'Regularizado',CONCLUIDO_APOS_PRAZO:'Concluído após o prazo',NO_PRAZO:'Dentro do prazo',PRODUZIDO_ATRASADO:'Produzido após a data',PRODUZIDO_NO_PRAZO:'Produzido no prazo',PENDENTE_VENCIDO:'Pendente vencido',PENDENTE_NO_PRAZO:'Pendente no prazo'};

export function GestaoAtrasosPage({user,active}:{user:User;active:boolean}) {
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
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const q=new URLSearchParams();
      Object.entries(filters).forEach(([k,v])=>{if(v)q.set(k,String(v));});q.set('page',String(page));
      setData(await apiRequest<Summary>(`/api/gestao-atrasos/resumo?${q}`));
    }catch(e){setError(e instanceof Error?e.message:'Falha ao carregar OPs.');}
    finally{setLoading(false);}
  },[filters,page]);
  useEffect(()=>{if(!active)return;const timer=setTimeout(()=>void load(),250);return()=>clearTimeout(timer);},[active,load,revision]);
  useEffect(()=>{if(active)void apiRequest<{setores:string[]}>('/api/gestao-atrasos/permissoes').then(r=>setAuthorized(r.setores)).catch(()=>setAuthorized([]));},[active]);
  const open=async(row:Row)=>{
    setSelected(row);setDetail(null);setHistory([]);setMotivo('');setPrevisao('');
    try {
      const [d,h]=await Promise.all([
        apiRequest<{series:Series[];progresso:Progress[];apontamentoImportado:boolean}>(`/api/gestao-atrasos/op/${encodeURIComponent(row.op)}?setor=${encodeURIComponent(row.setor)}`),
        apiRequest<{rows:History[]}>(`/api/gestao-atrasos/justificativas?op=${encodeURIComponent(row.op)}&setor=${encodeURIComponent(row.setor)}`),
      ]);setDetail(d);setHistory(h.rows);
    }catch(e){setError(e instanceof Error?e.message:'Falha ao abrir detalhamento.');}
  };
  const save=async()=>{
    if(!selected||motivo.trim().length<5||!previsao)return;
    setSaving(true);
    try {
      await apiRequest('/api/gestao-atrasos/justificativas',{method:'POST',body:JSON.stringify({op:selected.op,setor:selected.setor,motivo,previsao_regularizacao:previsao})});
      await open(selected);setRevision(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar justificativa.');}
    finally{setSaving(false);}
  };
  const importFile=async(file:File|undefined,tipo:DetailedTipo)=>{
    if(!file||importing)return;
    setImporting(true);setError('');setMismatch([]);
    const started=performance.now();
    try {
      setImportStatus(`Lendo ${file.name}...`);
      const preview=await readDetailedExcel(file,tipo,n=>setImportStatus(`${fmt(n)} linhas analisadas...`));
      const parsed=performance.now();
      const session=await apiRequest<{id:string}>('/api/gestao-atrasos/importacoes/iniciar',{method:'POST',body:JSON.stringify({tipo,esperado:preview.rows.length})});
      const size=1000;
      for(let start=0;start<preview.rows.length;start+=size){
        const linhas:DetailedRow[]=preview.rows.slice(start,start+size);
        await apiRequest('/api/gestao-atrasos/importacoes/lote',{method:'POST',body:JSON.stringify({tipo,id:session.id,linhas})});
        if(start%5000===0||start+size>=preview.rows.length) setImportStatus(`Enviados ${fmt(Math.min(start+size,preview.rows.length))} / ${fmt(preview.rows.length)} registros`);
      }
      const finished=await apiRequest<{importados:number;divergencias:Mismatch[];totalDivergencias:number;avisoConferencia:string|null}>('/api/gestao-atrasos/importacoes/finalizar',{method:'POST',body:JSON.stringify({tipo,id:session.id})});
      setMismatch(finished.divergencias);
      setImportStatus(`${fmt(finished.importados)} importados · leitura ${Math.round((parsed-started)/1000)} s · envio e validação ${Math.round((performance.now()-parsed)/1000)} s · total ${Math.round((performance.now()-started)/1000)} s. ${finished.totalDivergencias} divergências. ${finished.avisoConferencia||''}`);
      setRevision(n=>n+1);
    }catch(e){setError(e instanceof Error?e.message:'Falha na importação.');setImportStatus('Importação interrompida; dados ativos anteriores preservados.');}
    finally{setImporting(false);if(prog.current)prog.current.value='';if(apont.current)apont.current.value='';}
  };
  const rows=data?.rows||[];
  return <main className="app-container app-container--wide space-y-5 py-5">
    <header className="rounded-2xl border border-emerald-400/20 bg-[#0b1710] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">ITAM · Atraso</p><h1 className="mt-1 text-2xl font-bold text-white">Visão OP</h1><p className="text-sm text-slate-400">Pendências e produção por OP, data e setor. Período: mês anterior e atual.</p></div><button className={button} onClick={()=>setRevision(n=>n+1)}><RefreshCw size={16}/>Atualizar</button></div>
    </header>
    {user.perfil==='COORDENACAO'&&<section className="rounded-2xl border border-white/10 bg-[#0b1710] p-4"><h2 className="font-bold text-white">Importação detalhada</h2><p className="mt-1 text-xs text-slate-400">A base anterior fica ativa até a validação e substituição completas. Importe programação e apontamento separadamente.</p><div className="mt-3 flex flex-wrap gap-2"><input type="file" accept=".xlsx" ref={prog} className="hidden" aria-label="Programação detalhada" onChange={e=>void importFile(e.target.files?.[0],'PROGRAMACAO')}/><input type="file" accept=".xlsx" ref={apont} className="hidden" aria-label="Apontamento detalhado" onChange={e=>void importFile(e.target.files?.[0],'APONTAMENTO')}/><button className={button} disabled={importing} onClick={()=>prog.current?.click()}><FileUp size={16}/>Programação</button><button className={button} disabled={importing} onClick={()=>apont.current?.click()}><FileUp size={16}/>Apontamento</button></div><div className="mt-2 text-xs text-slate-400">{data?.importacoes.map(i=><span key={i.tipo} className="mr-4">{i.tipo}: {fmt(i.esperado)} linhas</span>)}</div>{importStatus&&<p role="status" className="mt-2 text-sm text-emerald-200">{importStatus}</p>}{mismatch.length>0&&<details className="mt-2 text-xs text-amber-200"><summary><AlertTriangle size={14} className="inline"/> Divergências de OP (até 100 exemplos)</summary>{mismatch.map((m,i)=><p key={i}>{m.serie} · {m.setor} · {m.origem}: {m.op_programacao} / {m.op_apontamento}</p>)}</details>}</section>}
    {data&&!data.importacoes.some(i=>i.tipo==='APONTAMENTO')&&<p role="alert" className="rounded-xl border border-amber-400/30 p-3 text-sm text-amber-200">Não há apontamento detalhado ativo. Os totais produzidos e as pendências não podem ser confirmados até a importação.</p>}
    {error&&<p role="alert" className="rounded-xl border border-rose-400/30 p-3 text-sm text-rose-200">{error}</p>}
    <section className="rounded-2xl border border-white/10 bg-[#0b1710] p-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs text-slate-400">OP<input className={field} value={filters.op} onChange={e=>update('op',e.target.value)} placeholder="Número da OP"/></label>
      <label className="text-xs text-slate-400">Série<input className={field} value={filters.serie} onChange={e=>update('serie',e.target.value)} placeholder="Série exata"/></label>
      <label className="text-xs text-slate-400">Setor<select className={field} value={filters.setor} onChange={e=>update('setor',e.target.value)}><option value="">Todos os autorizados</option>{authorized.map(s=><option key={s}>{s}</option>)}</select></label>
      <label className="text-xs text-slate-400">Linha<input className={field} value={filters.linha} onChange={e=>update('linha',e.target.value)} placeholder="MON, TRI, EPO..."/></label>
      <label className="text-xs text-slate-400">Cliente<input className={field} value={filters.cliente} onChange={e=>update('cliente',e.target.value)} placeholder="Nome do cliente"/></label>
      <label className="text-xs text-slate-400">Situação<select className={field} value={filters.situacao} onChange={e=>update('situacao',e.target.value)}><option value="ATRASADOS">Com atraso</option><option value="PENDENTES">Pendência vencida</option><option value="PRAZO_VENCIDO">Prazo vencido</option><option value="CONCLUIDOS">Concluídas</option><option value="TODOS">Todas</option></select></label>
      <label className="text-xs text-slate-400">Justificativa<select className={field} value={filters.justificativa} onChange={e=>update('justificativa',e.target.value)}><option value="">Todas</option><option value="SEM">Sem justificativa</option><option value="COM">Com justificativa</option></select></label>
      <label className="text-xs text-slate-400">Início<input type="date" className={field} value={filters.inicio} onChange={e=>update('inicio',e.target.value)}/></label>
      <label className="text-xs text-slate-400">Fim<input type="date" className={field} value={filters.fim} onChange={e=>update('fim',e.target.value)}/></label>
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-300"><input type="checkbox" checked={filters.multiplos} onChange={e=>update('multiplos',e.target.checked)}/>Programadas em vários dias</label>
    </div></section>
    <section className="rounded-2xl border border-white/10 bg-[#0b1710] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-white"><Search size={16} className="mr-2 inline"/>OPs encontradas: {fmt(data?.total||0)}</h2><span className="text-xs text-slate-400">{loading?'Atualizando...':`Página ${page} · ${rows.length} OP + setor exibidos`}</span></div>
      <div className="space-y-2">{rows.map(r=><button key={`${r.op}|${r.setor}`} onClick={()=>void open(r)} className="w-full rounded-xl border border-white/10 bg-[#101d15] p-3 text-left transition hover:border-emerald-400/40"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="font-bold text-white">OP {r.op}</span><span className="ml-2 text-sm text-emerald-200">{r.setor}</span><p className="text-xs text-slate-400">{r.cliente||'Cliente não informado'} · {r.linha||'—'} · {r.dias_programados} dia(s)</p></div><div className="text-right text-sm"><strong className={r.pendentes_vencidos?'text-rose-300':'text-emerald-300'}>{fmt(r.pendentes_vencidos)} pendentes vencidos</strong><p className="text-xs text-slate-400">{fmt(r.produzidos_em_atraso)} produzidos após a data · {situation[r.situacao]||r.situacao}</p></div></div><div className="mt-2 flex items-center gap-3 text-xs text-slate-400"><span>{fmt(r.produzidos)} / {fmt(r.programados)} produzidos</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400" style={{width:`${Math.min(100,100*r.produzidos/Math.max(1,r.programados))}%`}}/></div><span>{Math.round(100*r.produzidos/Math.max(1,r.programados))}%</span></div></button>)}{!loading&&!rows.length&&<p className="py-6 text-center text-sm text-slate-400">Nenhum registro neste filtro. Confira as importações ou amplie a situação.</p>}</div>
      <div className="mt-4 flex justify-end gap-2"><button className={button} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><button className={button} disabled={page*50>=(data?.total||0)} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
    </section>
    {selected&&<div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={`Detalhamento da OP ${selected.op}`}><div className="mx-auto max-w-5xl rounded-2xl border border-white/20 bg-[#09140e] p-4 shadow-2xl sm:p-6"><div className="flex justify-between gap-3"><div><p className="text-xs text-emerald-300">{selected.setor} · {selected.linha} · {selected.cliente}</p><h2 className="text-xl font-bold text-white">OP {selected.op}</h2><p className="text-xs text-slate-400">Potência: {selected.potencia||'Não informada'} · Programação: {br(selected.primeira_data_programada)} a {br(selected.ultima_data_programada)}</p></div><button className={button} onClick={()=>setSelected(null)} aria-label="Fechar"><X size={17}/></button></div>
      {!detail?<p className="mt-5 text-slate-400">Carregando detalhamento...</p>:<><h3 className="mt-6 font-bold text-white">Progresso dos setores · {fmt(detail.progresso[0]?.quantidade_op||0)} séries distintas na OP</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{detail.progresso.map(p=><div key={p.setor} className="rounded-xl border border-white/10 p-3 text-sm"><p className="font-semibold text-white">{p.setor}</p><p className="text-xs text-slate-400">{detail.apontamentoImportado?`${fmt(p.produzidos)} / ${fmt(p.programados)} · ${fmt(p.pendentes_vencidos)} vencidos · ${Math.round(100*p.produzidos/Math.max(1,p.programados))}%`:`Produção indisponível · ${fmt(p.programados)} programados`}</p><div className="mt-2 h-1.5 rounded bg-white/10"><div className="h-full rounded bg-emerald-400" style={{width:`${Math.min(100,100*p.produzidos/Math.max(1,p.programados))}%`}}/></div></div>)}</div>
      <h3 className="mt-6 font-bold text-white">Programações por data · {selected.setor}</h3>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(detail.series.reduce<Record<string,{programados:number;produzidos:number;vencidos:number}>>((acc,s)=>{const row=acc[s.data_programada]??{programados:0,produzidos:0,vencidos:0};row.programados++;if(s.data_produzida)row.produzidos++;if(s.situacao==='PENDENTE_VENCIDO')row.vencidos++;acc[s.data_programada]=row;return acc;},{})).map(([date,v])=><div key={date} className="rounded-xl border border-white/10 p-3 text-sm"><strong className="text-white">{br(date)}</strong><p className="text-xs text-slate-400">{fmt(v.programados)} programados · {fmt(v.produzidos)} produzidos · {fmt(v.vencidos)} pendentes vencidos</p></div>)}</div>
      <h3 className="mt-6 font-bold text-white">Programação e séries do seu setor</h3><p className="text-xs text-slate-400">{detail.apontamentoImportado?'Produção sem registro no arquivo importado aparece como pendente.':'Arquivo de apontamentos ainda não importado; produção indisponível.'}</p><div className="mt-2 max-h-72 overflow-auto rounded-xl border border-white/10"><table className="w-full min-w-[600px] text-left text-xs"><thead className="sticky top-0 bg-[#14251a] text-slate-300"><tr>{['Data programada','Série','Produzida em','Situação'].map(x=><th key={x} className="p-2">{x}</th>)}</tr></thead><tbody>{detail.series.map(s=><tr key={`${s.serie}|${s.data_programada}`} className="border-t border-white/10 text-slate-200"><td className="p-2">{br(s.data_programada)}</td><td className="p-2 font-mono">{s.serie}</td><td className="p-2">{br(s.data_produzida)}</td><td className="p-2">{detail.apontamentoImportado?(situation[s.situacao]||s.situacao):'Produção sem dados'}</td></tr>)}</tbody></table></div></>}
      <h3 className="mt-6 font-bold text-white">Justificativa e prazo · {selected.setor}</h3><p className="text-xs text-slate-400">A atualização cria um novo registro e preserva o histórico.</p><label className="mt-3 block text-sm text-slate-300">Motivo<textarea className={`${field} mt-1 min-h-24`} maxLength={3000} value={motivo} onChange={e=>setMotivo(e.target.value)}/></label><label className="mt-3 block text-sm text-slate-300">Previsão de regularização<input type="date" className={`${field} mt-1`} value={previsao} onChange={e=>setPrevisao(e.target.value)}/></label><button className={`${button} mt-3`} disabled={saving||motivo.trim().length<5||!previsao} onClick={()=>void save()}>{saving?'Salvando...':'Registrar justificativa e prazo'}</button>
      <h3 className="mt-6 font-bold text-white">Histórico ({history.length})</h3><div className="mt-2 max-h-52 space-y-2 overflow-auto">{history.map(h=><div key={h.id} className="rounded-xl border border-white/10 p-3 text-sm text-slate-200"><p className="whitespace-pre-wrap">{h.motivo}</p><p className="mt-2 text-xs text-slate-400">{h.responsavel} · {new Date(h.criado_em).toLocaleString('pt-BR')} · Prazo: {br(h.previsao_regularizacao)}</p></div>)}{!history.length&&<p className="text-xs text-slate-400">Nenhum registro anterior.</p>}</div></div></div>}
  </main>;
}
