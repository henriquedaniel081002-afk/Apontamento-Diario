import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ClipboardList, Download, Eye, FileUp, RefreshCw, Search } from 'lucide-react';
import { OpDetailModal } from '../gestao-atrasos/OpDetailModal';
import { ModalShell } from '../components/common/ModalShell';
import {fmt,br,situation,type Row,type Series,type Progress,type History,type Summary,type Mismatch} from '../gestao-atrasos/presentation';
import { FilterBar, FilterSelect } from '../dashboard/components/FilterBar';
import '../dashboard/dashboard.css';
import '../gestao-atrasos/gestao-atrasos.css';
import { OpKpis } from '../gestao-atrasos/OpKpis';
import { Button, DateInput, Field, Input, PageContainer, PageHeader, SectionCard, StatusBadge, type BadgeVariant, type DataTableColumn } from '../components/common/ui';
import { recordPerformance } from '../services/performanceService';
import type { User } from '../types';
import { apiRequest } from '../services/apiClient';
import { readDetailedExcel, type DetailedTipo, type DetailedRow } from '../gestao-atrasos/importDetailedExcel';
import { gerarPdfPrioridades, type RelatorioPrioridades } from '../gestao-atrasos/prioridadesPdf';

export function GestaoAtrasosPage({user,active}:{user:User;active:boolean}) {
  const emptyFilters={op:'',serie:'',setor:'',linha:'',cliente:'',inicio:'',fim:'',situacao:'TODOS',justificativa:'',multiplos:false};
  const [detailError,setDetailError]=useState('');
  const modalRequest=useRef<AbortController|null>(null);
  const [data,setData]=useState<Summary|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [filters,setFilters]=useState({op:'',serie:'',setor:'',linha:'',cliente:'',inicio:'',fim:'',situacao:'TODOS',justificativa:'',multiplos:false});
  const [page,setPage]=useState(1);
  const [selected,setSelected]=useState<Row|null>(null);
  const [detail,setDetail]=useState<{series:Series[];progresso:Progress[];apontamentoImportado:boolean}|null>(null);
  const [history,setHistory]=useState<History[]>([]);
  const [motivo,setMotivo]=useState('');const [previsao,setPrevisao]=useState('');
  const [saving,setSaving]=useState(false);const [importing,setImporting]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [showExportOptions,setShowExportOptions]=useState(false);
  const [importStatus,setImportStatus]=useState('');const [mismatch,setMismatch]=useState<Mismatch[]>([]);
  const [combinations,setCombinations]=useState<Array<{setor:string;linha:string}>>([]);
  const [optionsLoading,setOptionsLoading]=useState(false);
  const [optionsError,setOptionsError]=useState('');
  const [optionsRevision,setOptionsRevision]=useState(0);
  const sectors=useMemo(()=>[...new Set(combinations.map(c=>c.setor))],[combinations]);
  const lines=useMemo(()=>[...new Set(combinations.filter(c=>!filters.setor||c.setor===filters.setor).map(c=>c.linha))].sort(),[combinations,filters.setor]);
  const [revision,setRevision]=useState(0);
  const prog=useRef<HTMLInputElement>(null),apont=useRef<HTMLInputElement>(null);
  const update=(key:keyof typeof filters,value:string|boolean)=>{
    setFilters(old=>{
      const next={...old,[key]:value};
      if(key==='setor' && next.linha && !combinations.some(c=>(!value||c.setor===value)&&c.linha===next.linha))next.linha='';
      return next;
    });
    setPage(1);
  };
  const clearFilters=()=>{setFilters(emptyFilters);setPage(1);};
  const filtersActive=Object.entries(filters).some(([key,value])=>value!==emptyFilters[key as keyof typeof emptyFilters]);
  const refresh=()=>{setRevision(n=>n+1);setOptionsRevision(n=>n+1);};
  const load=useCallback(async(signal:AbortSignal)=>{
    setLoading(true);setError('');
    try {
      if((filters.op.trim()&&!/^\d{1,20}$/.test(filters.op.trim()))||(filters.serie.trim()&&!/^\d{1,20}$/.test(filters.serie.trim())))throw new Error('Informe apenas números em OP e Série (até 20 dígitos).');
      if(filters.inicio && filters.fim && filters.inicio>filters.fim) throw new Error('Início deve ser anterior ou igual ao fim.');
      const q=new URLSearchParams();
      Object.entries(filters).forEach(([k,v])=>{if(v)q.set(k,String(v));});q.set('page',String(page));
      const result=await apiRequest<Summary>(`/api/gestao-atrasos/resumo?${q}`,{signal});
      if(!signal.aborted){
        setData(result);
        setSelected(current=>current && (result.rows.find(r=>r.op===current.op && r.setor===current.setor &&
          r.data_programada===current.data_programada) || current));
      }
    }catch(e){if(!signal.aborted)setError(e instanceof Error?e.message:'Falha ao carregar OPs.');}
    finally{if(!signal.aborted)setLoading(false);}
  },[filters,page,user.id,user.perfil]);
  useEffect(()=>{if(!active)return;const controller=new AbortController();setLoading(true);const timer=setTimeout(()=>void load(controller.signal),250);return()=>{clearTimeout(timer);controller.abort();};},[active,load,revision]);
  useEffect(()=>{
    if(!active)return;
    const c=new AbortController();
    setOptionsLoading(true);setOptionsError('');
    const q=new URLSearchParams();
    if(filters.inicio)q.set('inicio',filters.inicio);
    if(filters.fim)q.set('fim',filters.fim);
    const timer=setTimeout(()=>{
      void apiRequest<{combinacoes:Array<{setor:string;linha:string}>}>(`/api/gestao-atrasos/filtros?${q}`,{signal:c.signal}).then(result=>{
        if(c.signal.aborted)return;
        setCombinations(result.combinacoes);
        setFilters(old=>{
          const setor=result.combinacoes.some(item=>item.setor===old.setor)?old.setor:'';
          const linha=result.combinacoes.some(item=>(!setor||item.setor===setor)&&item.linha===old.linha)?old.linha:'';
          if(setor===old.setor&&linha===old.linha)return old;
          setPage(1);
          return {...old,setor,linha};
        });
      }).catch(e=>{if(!c.signal.aborted){setCombinations([]);setOptionsError(e instanceof Error?e.message:'Falha ao carregar filtros.');}})
        .finally(()=>{if(!c.signal.aborted)setOptionsLoading(false);});
    },250);
    return()=>{clearTimeout(timer);c.abort();};
  },[active,filters.inicio,filters.fim,optionsRevision,user.id,user.perfil]);
  useEffect(()=>()=>modalRequest.current?.abort(),[]);
  const close=()=>{if(saving)return;modalRequest.current?.abort();setSelected(null);};
  const open=async(row:Row)=>{
    modalRequest.current?.abort();
    const controller=new AbortController();modalRequest.current=controller;
    setSelected(row);setDetail(null);setDetailError('');setHistory([]);setMotivo('');setPrevisao('');
    const q=new URLSearchParams({setor:row.setor});
    q.set('inicio',row.data_programada);
    q.set('fim',row.data_programada);
    for(const key of ['linha','cliente','serie'] as const)if(filters[key])q.set(key,filters[key]);
    try {
      const [d,h]=await Promise.all([
        apiRequest<{series:Series[];progresso:Progress[];apontamentoImportado:boolean}>(`/api/gestao-atrasos/op/${encodeURIComponent(row.op)}?${q}`,{signal:controller.signal}),
        apiRequest<{rows:History[]}>(`/api/gestao-atrasos/justificativas?op=${encodeURIComponent(row.op)}&setor=${encodeURIComponent(row.setor)}`,{signal:controller.signal}),
      ]);if(!controller.signal.aborted){setDetail(d);setHistory(h.rows);}
    }catch(e){if(!controller.signal.aborted)setDetailError(e instanceof Error?e.message:'Falha ao abrir detalhamento.');}
  };
  const save=async()=>{
    if(!selected||motivo.trim().length<5)return;
    setSaving(true);
    try {
      await apiRequest('/api/gestao-atrasos/justificativas',{method:'POST',body:JSON.stringify({op:selected.op,setor:selected.setor,motivo,previsao_regularizacao:previsao||null,inicio:selected.data_programada,fim:selected.data_programada})});
      await open(selected);setRevision(n=>n+1);
    }catch(e){setDetailError(e instanceof Error?e.message:'Falha ao salvar observação.');}
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
      refresh();
    }catch(e){setError(e instanceof Error?e.message:'Falha na importação.');setImportStatus('Envio interrompido. Confira a base ativa em Atualizar antes de reenviar; lotes pendentes não substituem a base ativa.');}
    finally{setImporting(false);if(prog.current)prog.current.value='';if(apont.current)apont.current.value='';}
  };
  const exportPdf=async(incluirHoje:boolean)=>{
    if(exporting||loading||importing||!data?.importacoes.some(i=>i.tipo==='APONTAMENTO'))return;
    setShowExportOptions(false);
    setExporting(true);setError('');
    try {
      if((filters.op.trim()&&!/^\d{1,20}$/.test(filters.op.trim()))||(filters.serie.trim()&&!/^\d{1,20}$/.test(filters.serie.trim())))
        throw new Error('Informe apenas números em OP e Série (até 20 dígitos).');
      const q=new URLSearchParams();
      Object.entries(filters).forEach(([key,value])=>{if(value)q.set(key,String(value));});
      q.set('incluirHoje',String(incluirHoje));
      const result=await apiRequest<RelatorioPrioridades>(`/api/gestao-atrasos/relatorio-prioridades?${q}`);
      if(!result.rows.length)throw new Error('Não há programações para o período e os filtros selecionados.');
      const bytes=gerarPdfPrioridades(result,{...filters,inicio:filters.inicio||data.periodo.inicio,fim:filters.fim||data.periodo.fim});
      const blob=new Blob([bytes as BlobPart],{type:'application/pdf'});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');
      anchor.href=url;anchor.download=`ITAM_Checklist_Prioridades_${result.hoje}.pdf`;
      document.body.append(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(e){setError(e instanceof Error?e.message:'Falha ao gerar PDF.');}
    finally{setExporting(false);}
  };
  const rows=data?.rows||[];
  const days=useMemo(()=>{
    const grouped=new Map<string,Row[]>();
    for(const row of data?.rows||[]){
      const group=grouped.get(row.data_programada);
      if(group)group.push(row);
      else grouped.set(row.data_programada,[row]);
    }
    return [...grouped];
  },[data]);
  const totalsByDate = useMemo(() => new Map(
    data?.totaisPorData?.map(total => [total.data_programada, total])
  ), [data]);
  const situationTone=(row:Row):BadgeVariant=>{
    if(row.situacao==='REGULARIZADO'||row.situacao==='NO_PRAZO')return 'success';
    if(row.situacao==='PRAZO_VENCIDO'||row.situacao==='PENDENTE_VENCIDO'||(row.pendentes_vencidos??0)>0)return 'danger';
    if(row.situacao==='SEM_JUSTIFICATIVA'||row.situacao==='SEM_PRAZO')return 'warning';
    return 'info';
  };
  const columns:DataTableColumn<Row>[]=[
    {id:'op',header:'OP / Cliente',cell:r=><div>
      <button type="button" disabled={loading||Boolean(error)} onClick={()=>void open(r)} className="font-black text-white underline-offset-4 transition-colors hover:text-emerald-300 hover:underline focus-visible:rounded-sm disabled:opacity-50">OP {r.op}</button>
      <p title={r.cliente||''} className="mt-1 text-xs text-slate-400">{r.cliente||'Cliente não informado'}</p>
    </div>},
    {id:'setor',header:'Setor / Linha',cell:r=><div>
      <p className="font-bold text-slate-100">{r.setor}</p>
      <p className="mt-1 text-xs text-slate-400">{r.linha||'—'} · {r.potencia||'—'}</p><p className="mt-1 text-xs text-slate-400">Ref. {r.referencia||'—'}</p>
    </div>},
    {id:'total',header:'Total OP',align:'right',cell:r=>fmt(r.qtde_total_op)},
    {id:'programados',header:'Programado',align:'right',cell:r=><div className="tabular-nums"><span className="font-bold text-slate-100">{fmt(r.programados)}</span></div>},
    {id:'produzidos',header:'Produzido',align:'right',cell:r=><span className="font-bold tabular-nums text-emerald-300">{fmt(r.produzidos)}</span>},
    {id:'pendentes',header:'Pendente',align:'right',cell:r=><div className="tabular-nums"><span className={r.pendentes_vencidos?'font-black text-rose-300':'font-bold text-slate-200'}>{fmt(r.produzidos===null?null:r.programados-r.produzidos)}</span><p className="mt-1 text-xs text-slate-500">{fmt(r.produzidos_em_atraso)} após data</p></div>},
    {id:'progresso',header:'Progresso',cell:r=>{if(r.produzidos===null)return '—';const percent=Math.round(100*r.produzidos/Math.max(1,r.programados));return <div><span className="text-sm font-extrabold tabular-nums text-white">{percent}%</span><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{width:`${Math.min(100,percent)}%`}}/></div></div>;}},
    {id:'situacao',header:'Situação',cell:r=><StatusBadge dot variant={situationTone(r)} className="op-status">{situation[r.situacao]||r.situacao}</StatusBadge>},
    {id:'justificativa',header:'Observação / Prazo',cell:r=><div className="text-xs"><p className="break-words" title={r.motivo||undefined}>{r.motivo||'—'}</p><p className="mt-1.5 text-slate-400">Previsão: {br(r.previsao_regularizacao)}</p></div>},
    {id:'acao',header:'Detalhes',align:'center',cell:r=><Button variant="secondary" size="icon" aria-label={`Detalhar OP ${r.op} - ${r.setor} - ${br(r.data_programada)}`} title={`Detalhar OP ${r.op} - ${r.setor} - ${br(r.data_programada)}`} disabled={loading||Boolean(error)} onClick={()=>void open(r)}><Eye className="size-4" aria-hidden="true"/></Button>},
  ];
  return <PageContainer as="main" size="wide" className="op-dashboard dashboard-shell space-y-5 py-6 sm:py-8">
    <PageHeader
      eyebrow={user.perfil==='COORDENACAO'?'COORDENAÇÃO · PRODUÇÃO':'PRODUÇÃO'}
      title="Acompanhamento da Produção — Visão por OP"
      description="Consulte a programação, a produção e as pendências de cada setor por data programada. O período padrão inclui o mês anterior e o atual."
      icon={<ClipboardList className="size-5" aria-hidden="true"/>}
      actions={<div className="flex flex-wrap items-center gap-2"><Button variant="secondary" size="sm" leftIcon={<Download className="size-4" aria-hidden="true"/>} disabled={loading||importing||exporting||!data?.importacoes.some(i=>i.tipo==='APONTAMENTO')} onClick={()=>setShowExportOptions(true)}>{exporting?'Gerando PDF...':'PDF · Checklist do líder'}</Button><Button variant="ghost" size="sm" leftIcon={<RefreshCw className="size-4" aria-hidden="true"/>} isLoading={loading} loadingLabel="Atualizando" onClick={refresh}>Atualizar</Button></div>}
    />
    <FilterBar onClear={clearFilters} clearDisabled={!filtersActive} note="Indicadores do conjunto filtrado">
      <FilterSelect id="op-setor" label="Setor" options={['',...sectors]} selected={filters.setor} onSelect={v=>update('setor',v)} formatOption={v=>v||'Todos os autorizados'} active={Boolean(filters.setor)} disabled={optionsLoading||Boolean(optionsError)}/>
      <FilterSelect id="op-linha" label="Linha" options={['',...lines]} selected={filters.linha} onSelect={v=>update('linha',v)} formatOption={v=>v||'Todas'} active={Boolean(filters.linha)} disabled={optionsLoading||Boolean(optionsError)}/>
      <Field label="OP"><Input value={filters.op} onChange={e=>update('op',e.target.value)} placeholder="Número da OP" inputMode="numeric" maxLength={20}/></Field>
      <Field label="Série"><Input value={filters.serie} onChange={e=>update('serie',e.target.value)} placeholder="Série exata" inputMode="numeric" maxLength={20}/></Field>
      <Field label="Cliente"><Input value={filters.cliente} onChange={e=>update('cliente',e.target.value)} placeholder="Nome do cliente"/></Field>
      <FilterSelect id="op-situacao" label="Situação" options={['TODOS','ATRASADOS']} selected={filters.situacao} onSelect={v=>update('situacao',v)} formatOption={v=>(({ATRASADOS:'Atrasos',TODOS:'Todos'} as Record<string,string>)[v]||v)} active={filters.situacao!=='TODOS'}/>
      <FilterSelect id="op-justificativa" label="Observação" options={['','SEM','COM']} selected={filters.justificativa} onSelect={v=>update('justificativa',v)} formatOption={v=>(({'':'Todas','SEM':'Sem observação','COM':'Com observação'} as Record<string,string>)[v]||v)} active={Boolean(filters.justificativa)}/>
      <Field label="Início"><DateInput value={filters.inicio} onChange={e=>update('inicio',e.target.value)}/></Field>
      <Field label="Fim"><DateInput value={filters.fim} onChange={e=>update('fim',e.target.value)}/></Field>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm font-medium text-slate-300"><input type="checkbox" className="size-4 accent-emerald-400" checked={filters.multiplos} onChange={e=>update('multiplos',e.target.checked)}/>Programadas em vários dias</label>
    </FilterBar>
    {optionsLoading&&<p role="status" className="text-xs text-slate-400">Atualizando setores e linhas do período...</p>}
    {optionsError&&<p role="alert" className="text-sm text-rose-200">{optionsError} Use Atualizar para tentar novamente.</p>}
    {filtersActive&&<p className="text-xs text-slate-400" aria-live="polite">Filtros ativos · {filters.setor||'Todos os setores autorizados'} · {filters.linha||'Todas as linhas'}{filters.op?` · OP ${filters.op}`:''}{filters.serie?` · Série ${filters.serie}`:''}{filters.cliente?` · Cliente ${filters.cliente}`:''} · {filters.inicio||'Início padrão'} a {filters.fim||'Fim padrão'} · {filters.situacao}{filters.justificativa?` · Observação: ${filters.justificativa}`:''}{filters.multiplos?' · Vários dias':''}</p>}
    <p className="text-xs text-slate-400">O PDF lista os atrasos pendentes. “Incluir hoje” acrescenta a programação de hoje mesmo com o filtro Atrasos, dentro do período e dos demais filtros.</p>
    <OpKpis values={data?.kpis} loading={loading}/>
    {user.perfil==='COORDENACAO'&&<details className="op-import"><summary>Importação detalhada · programação e apontamento</summary><SectionCard title="Importação detalhada" description="A base anterior permanece ativa até a validação e substituição completas." icon={<FileUp className="size-5" aria-hidden="true"/>}>
      <p className="mb-3 text-sm leading-5 text-slate-400">Importe programação e apontamento separadamente. Sem período definido, a importação considera o mês anterior e o atual; para outro período, preencha Início e Fim nos filtros.</p>
      <div className="flex flex-wrap items-center gap-2">
        <input type="file" accept=".xlsx" ref={prog} className="hidden" aria-label="Programação detalhada" onChange={e=>void importFile(e.target.files?.[0],'PROGRAMACAO')}/>
        <input type="file" accept=".xlsx" ref={apont} className="hidden" aria-label="Apontamento detalhado" onChange={e=>void importFile(e.target.files?.[0],'APONTAMENTO')}/>
        <Button variant="secondary" size="sm" leftIcon={<FileUp className="size-4" aria-hidden="true"/>} disabled={importing} onClick={()=>prog.current?.click()}>Programação</Button>
        <Button variant="secondary" size="sm" leftIcon={<FileUp className="size-4" aria-hidden="true"/>} disabled={importing} onClick={()=>apont.current?.click()}>Apontamento</Button>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 sm:ml-auto">{data?.importacoes.map(i=><span key={i.tipo}>{i.tipo}: <strong className="font-semibold text-slate-200">{fmt(i.esperado)} linhas</strong></span>)}</div>
      </div>
      {importStatus&&<p role="status" className="mt-3 text-sm text-emerald-200">{importStatus}</p>}
      {mismatch.length>0&&<details className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-200"><summary className="cursor-pointer font-bold"><AlertTriangle size={14} className="mr-1 inline"/>Divergências de OP (até 100 exemplos)</summary><div className="mt-2 space-y-1">{mismatch.map((m,i)=><p key={i}>{m.serie} · {m.setor} · {m.origem}: {m.op_programacao} / {m.op_apontamento}</p>)}</div></details>}
    </SectionCard></details>}
    {data&&!data.importacoes.some(i=>i.tipo==='APONTAMENTO')&&<p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-200">Não há apontamento detalhado ativo. Os totais produzidos e as pendências não podem ser confirmados até a importação.</p>}
    {error&&<p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] p-3 text-sm text-rose-200">{error}</p>}
    <SectionCard title={`Grupos por data, OP e setor · ${fmt(data?.total||0)}`} icon={<Search className="size-5" aria-hidden="true"/>} description={data?.periodo ? `Período de ${br(data.periodo.inicio)} a ${br(data.periodo.fim)} (inclusive).` : undefined} actions={<span className="text-xs font-medium text-slate-400" aria-live="polite">{loading?'Atualizando...':`Página ${page} · ${rows.length} grupos exibidos`}</span>}>
      <div aria-busy={loading} className="min-w-0">
        <div className="op-groups" role="region" aria-label="Programação por data, OP e setor">
          {days.length > 0 && <p className="mb-2 text-xs text-slate-400">Totais por data programada em todas as páginas, com os filtros selecionados.</p>}
          {days.map(([date, group]) => {
            const total = totalsByDate.get(date);
            return <section key={date} aria-label={`Programação de ${br(date)}`}>
              <div className="op-day-heading">
                <h3>{br(date)}</h3>
                {total && <div className="op-day-totals">
                  <span>Programado: <strong>{fmt(total.programado)}</strong></span>
                  <span>Produzido: <strong>{fmt(total.produzido)}</strong></span>
                  <span>Percentual: <strong>{total.percentual === null ? '—' : total.percentual.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'}</strong></span>
                </div>}
              </div>
              <table className="op-schedule" role="table">
                <caption className="sr-only">Programação de {br(date)} por OP e setor</caption>
                <thead role="rowgroup"><tr role="row">{columns.map(c =>
                  <th scope="col" role="columnheader" key={c.id} data-col={c.id} data-align={c.align}>{c.header}</th>
                )}</tr></thead>
                <tbody role="rowgroup">{group.map((row, index) =>
                  <tr role="row" key={JSON.stringify([date, row.op, row.setor])}>
                    {columns.map(c => <td role="cell" key={c.id} data-col={c.id} data-align={c.align}>
                      <span className="op-card-label" aria-hidden="true">{c.header}</span>
                      <div className="op-cell">{c.cell(row, index)}</div>
                    </td>)}
                  </tr>
                )}</tbody>
              </table>
            </section>;
          })}
          {!days.length&&<p className="py-8 text-center text-sm text-slate-400">{loading?'Carregando resultados...':'Nenhum registro neste filtro.'}</p>}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{fmt(data?.total||0)} resultados · 50 por página</p><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button variant="secondary" size="sm" disabled={loading||page*50>=(data?.total||0)} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div></div>
      </div>
    </SectionCard>
    <ModalShell
      isOpen={showExportOptions}
      onClose={()=>setShowExportOptions(false)}
      title="Adicionar programação de hoje?"
      description="Defina se o checklist deve incluir a programação do dia atual."
      size="sm"
      footer={<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={()=>void exportPdf(false)}>Não, somente anteriores</Button>
        <Button variant="primary" onClick={()=>void exportPdf(true)}>Sim, incluir hoje</Button>
      </div>}
    >
      <p className="text-sm leading-6 text-slate-300">“Somente anteriores” exporta as pendências até ontem. “Incluir hoje” acrescenta todas as OPs de hoje em uma seção própria, inclusive as concluídas, mesmo com Atrasos selecionado. O período e os demais filtros continuam valendo.</p>
    </ModalShell>
    {selected&&<OpDetailModal key={JSON.stringify([selected.data_programada,selected.op,selected.setor])} {...{selected,detail,history,detailError,motivo,previsao,saving,close,open,save,setMotivo,setPrevisao}}/>}
  </PageContainer>;
}
