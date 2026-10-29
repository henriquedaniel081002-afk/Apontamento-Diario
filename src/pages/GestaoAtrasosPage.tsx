import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileUp, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import type { User } from '../types';
import { apiRequest } from '../services/apiClient';
import { readDetailedExcel, type DetailedTipo, type DetailedRow } from '../gestao-atrasos/importDetailedExcel';

type Row = {
  op:string;setor:string;linha:string;cliente:string;quantidade_op:number;programados:number;produzidos:number;
  pendentes_vencidos:number;produzidos_em_atraso:number;primeira_data_programada:string;ultima_data_programada:string;
};
type Justificativa = {op:string;setor:string;motivo:string;previsao_regularizacao:string|null;responsavel:string;criado_em:string};
type Resumo = {
  periodo:{inicio:string;fimExclusivo:string;hoje:string};rows:Row[];justificativas:Justificativa[];
  importacoes:{tipo:DetailedTipo;esperado:number;atualizado_em:string}[];
};
type Mismatch = {serie:string;setor:string;op_programacao:string;op_apontamento:string;origem:'ENTRE_ARQUIVOS'|'PROGRAMACAO'|'APONTAMENTO'};
function sector(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();}
function brDate(v:string|null|undefined) {if(!v)return '—';const s=String(v).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?`${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}`:s;}
function number(v:number){return Number(v||0).toLocaleString('pt-BR');}
const inputClass='w-full min-w-0 rounded-xl border border-white/15 bg-[#101b16] px-3 py-2 text-sm text-white outline-none focus:border-emerald-400';
const buttonClass='inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50';
export function GestaoAtrasosPage({user}:{user:User}) {
  const [data,setData]=useState<Resumo|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [filter,setFilter]=useState('');
  const [line,setLine]=useState('ALL');
  const [onlyLate,setOnlyLate]=useState(false);
  const [chosen,setChosen]=useState<Row|null>(null);
  const [motivo,setMotivo]=useState('');
  const [previsao,setPrevisao]=useState('');
  const [history,setHistory]=useState<{id:number;motivo:string;previsao_regularizacao:string|null;criado_em:string;responsavel:string}[]>([]);
  const [saving,setSaving]=useState(false);
  const [importing,setImporting]=useState(false);
  const [importStatus,setImportStatus]=useState('');
  const [mismatch,setMismatch]=useState<Mismatch[]>([]);
  const [mismatchTotal,setMismatchTotal]=useState(0);
  const [authorizedSectors,setAuthorizedSectors]=useState<string[]>([]);
  const fileProg=useRef<HTMLInputElement>(null);
  const fileApont=useRef<HTMLInputElement>(null);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {setData(await apiRequest<Resumo>('/api/gestao-atrasos/resumo'));}
    catch(e){setError(e instanceof Error?e.message:'Falha ao consultar a Gestão de Atrasos.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    let alive=true;
    void apiRequest<{setores:string[]}>('/api/gestao-atrasos/permissoes')
      .then(result=>{if(alive)setAuthorizedSectors(result.setores);})
      .catch(()=>{if(alive)setAuthorizedSectors([]);});
    return ()=>{alive=false;};
  },[]);
  const latest=useMemo(()=>new Map((data?.justificativas||[]).map(j=>[`${j.op}|${j.setor}`,j])),[data]);
  const lines=useMemo(()=>[...new Set((data?.rows||[]).map(r=>r.linha))].filter(Boolean).sort(),[data]);
  const rows=useMemo(()=> (data?.rows||[]).filter(r=>
    (line==='ALL'||r.linha===line) && (!onlyLate||r.pendentes_vencidos>0||r.produzidos_em_atraso>0) &&
    (!filter||`${r.op} ${r.cliente} ${r.setor} ${r.linha}`.toUpperCase().includes(filter.toUpperCase()))
  ),[data,filter,line,onlyLate]);
  const ops=useMemo(()=>new Set(rows.map(r=>r.op)).size,[rows]);
  const late=useMemo(()=>rows.filter(r=>r.pendentes_vencidos>0).length,[rows]);
  const importFile=async(file:File|undefined,tipo:DetailedTipo)=>{
    if(!file||importing)return;
    setImporting(true);setError('');setMismatch([]);setMismatchTotal(0);
    try {
      setImportStatus(`Lendo ${file.name}...`);
      const preview=await readDetailedExcel(file,tipo,n=>setImportStatus(`Lendo Excel: ${number(n)} linhas analisadas...`));
      setImportStatus(`${number(preview.rows.length)} registros no período. Iniciando envio...`);
      const session=await apiRequest<{id:string}>( '/api/gestao-atrasos/importacoes/iniciar',{
        method:'POST',body:JSON.stringify({tipo,esperado:preview.rows.length}),
      });
      const size=400;
      for(let start=0;start<preview.rows.length;start+=size){
        const linhas:DetailedRow[]=preview.rows.slice(start,start+size);
        await apiRequest('/api/gestao-atrasos/importacoes/lote',{
          method:'POST',body:JSON.stringify({tipo,id:session.id,linhas}),
        });
        if(start%4000===0||start+size>=preview.rows.length)
          setImportStatus(`Enviados ${number(Math.min(start+size,preview.rows.length))}/${number(preview.rows.length)} registros...`);
      }
      const finished=await apiRequest<{importados:number;divergencias:Mismatch[];totalDivergencias:number;divergenciasLimitadas:boolean;avisoConferencia:string|null}>('/api/gestao-atrasos/importacoes/finalizar',{
        method:'POST',body:JSON.stringify({tipo,id:session.id}),
      });
      setMismatch(finished.divergencias);setMismatchTotal(finished.totalDivergencias);
      setImportStatus(`Importação de ${tipo==='PROGRAMACAO'?'programação':'apontamento'} concluída: ${number(finished.importados)} registros. ${finished.avisoConferencia || (finished.totalDivergencias?`${finished.totalDivergencias} divergência(s) de OP; veja os avisos abaixo${finished.divergenciasLimitadas?' (primeiras 100)':''}.`:'Sem divergências de OP identificadas.')}`);
      void load();
    }catch(e){setError(e instanceof Error?e.message:'Falha na importação. Dados anteriores preservados.');setImportStatus('Importação não concluída. A base ativa anterior permanece disponível.');}
    finally {setImporting(false);if(fileProg.current)fileProg.current.value='';if(fileApont.current)fileApont.current.value='';}
  };
  const openJust=async(r:Row)=>{
    setChosen(r);setMotivo('');setPrevisao('');setHistory([]);
    try{const result=await apiRequest<{rows:typeof history}>(`/api/gestao-atrasos/justificativas?op=${encodeURIComponent(r.op)}&setor=${encodeURIComponent(r.setor)}`);setHistory(result.rows);}
    catch(e){setError(e instanceof Error?e.message:'Falha ao ler justificativas.');}
  };
  const save=async()=>{
    if(!chosen||!(user.perfil==='COORDENACAO'||authorizedSectors.includes(sector(chosen.setor)))||motivo.trim().length<5)return;
    setSaving(true);
    try{
      await apiRequest('/api/gestao-atrasos/justificativas',{
        method:'POST',body:JSON.stringify({op:chosen.op,setor:chosen.setor,motivo,previsao_regularizacao:previsao||null}),
      });
      setMotivo('');setPrevisao('');await openJust(chosen);await load();
    } catch(e){setError(e instanceof Error?e.message:'Falha ao salvar justificativa.');}
    finally{setSaving(false);}
  };
  return <main className="app-container app-container--wide space-y-5 py-6 sm:py-8">
    <header className="rounded-2xl border border-emerald-400/15 bg-[#09140e] p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">ITAM · Gestão por OP · Supabase</p>
          <h1 className="mt-1 text-2xl font-black text-white md:text-3xl">Gestão de Atrasos por OP</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">Programação x apontamento por série e setor. Período automático: mês atual + mês anterior. A tela atual de Atrasos por série permanece independente.</p></div>
        <button className={buttonClass} onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>Atualizar</button>
      </div>
      {data&&<p className="mt-3 text-xs font-medium text-slate-400">Período: {brDate(data.periodo.inicio)} até {brDate(new Date(new Date(`${data.periodo.fimExclusivo}T00:00:00Z`).getTime()-86400000).toISOString().slice(0,10))} · Hoje: {brDate(data.periodo.hoje)}</p>}
    </header>
    {user.perfil==='COORDENACAO'&&<section className="rounded-2xl border border-white/10 bg-[#0b1710] p-5">
      <h2 className="text-lg font-bold text-white">Importação detalhada — substituição integral</h2>
      <p className="mt-1 text-sm text-slate-400">Importe cada Excel nesta aba para atualizar o acompanhamento por OP. As importações simplificadas da tela Registros continuam iguais. Apenas os dois meses mais recentes são armazenados aqui. A base anterior permanece ativa até o término bem-sucedido.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <input ref={fileProg} aria-label="Arquivo da programação detalhada" className="hidden" type="file" accept=".xlsx" onChange={e=>void importFile(e.target.files?.[0],'PROGRAMACAO')}/>
        <input ref={fileApont} aria-label="Arquivo do apontamento detalhado" className="hidden" type="file" accept=".xlsx" onChange={e=>void importFile(e.target.files?.[0],'APONTAMENTO')}/>
        <button className={buttonClass} disabled={importing} onClick={()=>fileProg.current?.click()}><FileUp size={16}/>Substituir programação detalhada</button>
        <button className={buttonClass} disabled={importing} onClick={()=>fileApont.current?.click()}><FileUp size={16}/>Substituir apontamento detalhado</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">{(data?.importacoes||[]).map(i=><span key={i.tipo}>{i.tipo}: {number(i.esperado)} linhas · {new Date(i.atualizado_em).toLocaleString('pt-BR')}</span>)}</div>
      {importStatus&&<p role="status" className="mt-3 rounded-xl bg-emerald-400/5 p-3 text-sm text-emerald-100">{importing?'Processando — ':''}{importStatus}</p>}
      {!!mismatch.length&&<div className="mt-3 rounded-xl border border-amber-400/30 p-3"><p className="flex items-center gap-2 font-semibold text-amber-200"><AlertTriangle size={16}/>Importação permitida: {mismatchTotal} divergência(s) de OP identificada(s){mismatchTotal>mismatch.length?' (até 100 exibidas)':''}</p>
        <div className="mt-2 max-h-40 overflow-auto text-xs text-slate-300">{mismatch.map((m,i)=><div key={`${m.serie}|${m.setor}|${i}`} className="py-1">Série {m.serie} · {m.setor} · {m.origem==='ENTRE_ARQUIVOS'?'Arquivos diferentes':m.origem==='PROGRAMACAO'?'Na programação':'No apontamento'}: OP {m.op_programacao} e OP {m.op_apontamento}</div>)}</div></div>}
    </section>}
    {error&&<div role="alert" className="rounded-xl border border-red-400/40 bg-red-400/5 p-4 text-sm text-red-200">{error}</div>}
    {loading&&!data?<p className="text-slate-400">Carregando dados...</p>:<>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[['OPs no filtro',ops],['OP + setor',rows.length],['Setores com pendência vencida',late],['Justificativas registradas',data?.justificativas.length||0]].map(([label,val])=><div key={String(label)} className="rounded-xl border border-white/10 bg-[#0b1710] p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-2xl font-black text-white">{number(Number(val))}</p></div>)}</div>
      <section className="rounded-2xl border border-white/10 bg-[#0b1710] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center">
        <label className="flex flex-1 items-center gap-2 text-slate-400"><Search size={17}/><input className={inputClass} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Buscar OP, cliente, setor ou linha"/></label>
        <select aria-label="Filtrar linha" className={inputClass+' md:w-48'} value={line} onChange={e=>setLine(e.target.value)}><option value="ALL">Todas as linhas</option>{lines.map(l=><option key={l}>{l}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={onlyLate} onChange={e=>setOnlyLate(e.target.checked)}/>Com atrasos</label>
      </div><div className="mt-4 max-h-[650px] overflow-auto"><table className="w-full min-w-[950px] text-left text-sm"><thead className="sticky top-0 bg-[#0c1a13] text-xs uppercase tracking-wide text-slate-400"><tr>{['OP','Setor','Cliente / linha','Total OP','Previsto setor','Apontado','Faltam','Vencidos','Últ. programação','Justificativa'].map(t=><th key={t} className="px-3 py-3">{t}</th>)}</tr></thead>
        <tbody>{rows.map(r=>{const j=latest.get(`${r.op}|${r.setor}`);const faltam=Math.max(0,Number(r.programados)-Number(r.produzidos));return <tr key={`${r.op}|${r.setor}`} className="border-t border-white/10 text-slate-200 hover:bg-white/[0.03]"><td className="px-3 py-3 font-bold">{r.op}</td><td className="px-3 py-3">{r.setor}</td><td className="px-3 py-3 text-xs">{r.cliente}<div className="text-slate-400">{r.linha}</div></td><td className="px-3 py-3">{number(r.quantidade_op)}</td><td className="px-3 py-3">{number(r.programados)}</td><td className="px-3 py-3"><span className="font-semibold text-emerald-300">{number(r.produzidos)}</span><div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400" style={{width:`${Math.min(100,100*r.produzidos/Math.max(1,r.programados))}%`}}/></div></td><td className="px-3 py-3">{number(faltam)}</td><td className={`px-3 py-3 font-bold ${r.pendentes_vencidos>0?'text-rose-300':'text-slate-400'}`}>{number(r.pendentes_vencidos)}</td><td className="px-3 py-3 whitespace-nowrap">{brDate(r.ultima_data_programada)}</td><td className="px-3 py-3"><button className="rounded-lg border border-white/20 px-2 py-1 text-xs hover:border-emerald-400" onClick={()=>void openJust(r)}>{j?<CheckCircle2 size={13} className="mr-1 inline text-emerald-300"/>:<ShieldCheck size={13} className="mr-1 inline"/>}{j?'Ver justificativa':'Justificar / ver'}</button></td></tr>})}</tbody>
      </table>{!rows.length&&<p className="p-5 text-sm text-slate-400">Sem registros neste recorte. Verifique as duas importações detalhadas.</p>}</div></section>
    </>}
    {chosen&&<div className="fixed inset-0 z-[100] flex items-center justify-center overflow-auto bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Justificativas de atraso"><div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#09140e] p-5 shadow-2xl">
      <div className="flex justify-between gap-4"><div><h2 className="text-lg font-bold text-white">OP {chosen.op} · {chosen.setor}</h2><p className="text-xs text-slate-400">Histórico de justificativas por OP e setor</p></div><button className={buttonClass} onClick={()=>setChosen(null)}>Fechar</button></div>
      {(user.perfil==='COORDENACAO'||authorizedSectors.includes(sector(chosen.setor)))?<div className="mt-5 space-y-3"><label className="block text-sm text-slate-300">Motivo do atraso<textarea className={inputClass+' mt-1 min-h-24'} value={motivo} onChange={e=>setMotivo(e.target.value)} maxLength={3000} placeholder="Descreva a causa e as providências"/></label><label className="block text-sm text-slate-300">Previsão de regularização (opcional)<input type="date" className={inputClass+' mt-1'} value={previsao} onChange={e=>setPrevisao(e.target.value)}/></label><button disabled={saving||motivo.trim().length<5} className={buttonClass} onClick={()=>void save()}>{saving?'Salvando...':'Salvar justificativa'}</button></div>:<p className="mt-4 rounded-lg border border-amber-400/25 p-3 text-sm text-amber-200">Somente líderes autorizados para este setor podem registrar justificativas. Você pode consultar o histórico.</p>}
      <h3 className="mt-6 text-sm font-bold text-slate-200">Histórico ({history.length})</h3><div className="mt-2 max-h-60 space-y-2 overflow-auto">{history.map(h=><div key={h.id} className="rounded-xl border border-white/10 p-3 text-sm text-slate-200"><p className="whitespace-pre-wrap">{h.motivo}</p><p className="mt-2 text-xs text-slate-400">{h.responsavel} · {new Date(h.criado_em).toLocaleString('pt-BR')} · Previsão: {brDate(h.previsao_regularizacao)}</p></div>)}{!history.length&&<p className="text-sm text-slate-400">Nenhuma justificativa registrada.</p>}</div>
    </div></div>}
  </main>;
}
