import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ClipboardList, Eye, FileUp, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { OpDetailModal } from '../gestao-atrasos/OpDetailModal';
import {fmt,br,situation,type Row,type Series,type Progress,type History,type Summary,type Mismatch} from '../gestao-atrasos/presentation';
import { OpKpis } from '../gestao-atrasos/OpKpis';
import { Badge, Button, DataTable, DateInput, Field, FilterPanel, Input, PageContainer, PageHeader, SectionCard, SelectField, StatusBadge, type BadgeVariant, type DataTableColumn } from '../components/common/ui';
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
  const situationTone=(row:Row):BadgeVariant=>{
    if(row.situacao==='REGULARIZADO'||row.situacao==='NO_PRAZO')return 'success';
    if(row.situacao==='PRAZO_VENCIDO'||row.situacao==='PENDENTE_VENCIDO'||row.pendentes_vencidos>0)return 'danger';
    if(row.situacao==='SEM_JUSTIFICATIVA'||row.situacao==='SEM_PRAZO')return 'warning';
    return 'info';
  };
  const columns:DataTableColumn<Row>[]=[
    {id:'op',header:'OP / Cliente',cell:r=><div className="min-w-[9rem] max-w-52">
      <button type="button" disabled={loading||Boolean(error)} onClick={()=>void open(r)} className="font-black text-white underline-offset-4 transition-colors hover:text-emerald-300 hover:underline focus-visible:rounded-sm disabled:opacity-50">OP {r.op}</button>
      <p title={r.cliente||''} className="mt-1 truncate text-xs text-slate-400">{r.cliente||'Cliente não informado'}</p>
    </div>},
    {id:'setor',header:'Setor / Linha',cell:r=><div className="min-w-32">
      <p className="font-bold text-slate-100">{r.setor}</p>
      <p className="mt-1 text-xs text-slate-400">{r.linha||'—'} · {r.potencia||'Potência não informada'}</p>
    </div>},
    {id:'programados',header:'Programado',align:'right',cell:r=><div className="tabular-nums"><span className="font-bold text-slate-100">{fmt(r.programados)}</span><p className="mt-1 whitespace-nowrap text-xs text-slate-500">{r.dias_programados} dia(s)</p></div>},
    {id:'produzidos',header:'Produzido',align:'right',cell:r=><span className="font-bold tabular-nums text-emerald-300">{fmt(r.produzidos)}</span>},
    {id:'pendentes',header:'Vencidos',align:'right',cell:r=><div className="tabular-nums"><span className={r.pendentes_vencidos?'font-black text-rose-300':'font-bold text-slate-200'}>{fmt(r.pendentes_vencidos)}</span><p className="mt-1 whitespace-nowrap text-xs text-slate-500">{fmt(r.produzidos_em_atraso)} após data</p></div>},
    {id:'progresso',header:'Progresso',cell:r=>{const percent=Math.round(100*r.produzidos/Math.max(1,r.programados));return <div className="min-w-28"><span className="text-sm font-extrabold tabular-nums text-white">{percent}%</span><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{width:`${Math.min(100,percent)}%`}}/></div></div>;}},
    {id:'situacao',header:'Situação',cell:r=><StatusBadge dot variant={situationTone(r)} className="whitespace-nowrap">{situation[r.situacao]||r.situacao}</StatusBadge>},
    {id:'justificativa',header:'Justificativa / Prazo',cell:r=><div className="min-w-28 text-xs"><Badge variant={r.motivo?'info':'warning'}>{r.motivo?'Registrada':'Não informada'}</Badge><p className="mt-1.5 whitespace-nowrap text-slate-400">Previsão: {br(r.previsao_regularizacao)}</p><p className="mt-0.5 whitespace-nowrap text-slate-500">{br(r.primeira_data_programada)} a {br(r.ultima_data_programada)}</p></div>},
    {id:'acao',header:'Detalhes',align:'center',cell:r=><Button variant="secondary" size="icon" aria-label={`Detalhar OP ${r.op} - ${r.setor}`} title={`Detalhar OP ${r.op} - ${r.setor}`} disabled={loading||Boolean(error)} onClick={()=>void open(r)}><Eye className="size-4" aria-hidden="true"/></Button>},
  ];
  return <PageContainer as="main" size="wide" className="space-y-5 py-6 sm:py-8">
    <PageHeader
      eyebrow={user.perfil==='COORDENACAO'?'COORDENAÇÃO · ATRASO':'ACOMPANHAMENTO · ATRASO'}
      title="Atraso — Visão OP"
      description="Acompanhe pendências, produção, justificativas e prazos por OP e setor. Sem datas selecionadas: mês anterior e atual; os limites informados são inclusivos."
      icon={<ClipboardList className="size-5" aria-hidden="true"/>}
      actions={<Button variant="ghost" size="sm" leftIcon={<RefreshCw className="size-4" aria-hidden="true"/>} isLoading={loading} loadingLabel="Atualizando" onClick={()=>setRevision(n=>n+1)}>Atualizar</Button>}
    />
    <OpKpis values={data?.kpis} loading={loading}/>
    {user.perfil==='COORDENACAO'&&<SectionCard title="Importação detalhada" description="A base anterior permanece ativa até a validação e substituição completas." icon={<FileUp className="size-5" aria-hidden="true"/>}>
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
    </SectionCard>}
    {data&&!data.importacoes.some(i=>i.tipo==='APONTAMENTO')&&<p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3 text-sm text-amber-200">Não há apontamento detalhado ativo. Os totais produzidos e as pendências não podem ser confirmados até a importação.</p>}
    {error&&<p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/[0.06] p-3 text-sm text-rose-200">{error}</p>}
    <FilterPanel title="Filtros dos registros" description="Os filtros aplicam-se aos resultados e indicadores." actions={<Button variant="ghost" size="sm" leftIcon={<RotateCcw className="size-4" aria-hidden="true"/>} onClick={()=>{setFilters(emptyFilters);setPage(1);}}>Limpar filtros</Button>}>
      <Field label="OP"><Input value={filters.op} onChange={e=>update('op',e.target.value)} placeholder="Número da OP"/></Field>
      <Field label="Série"><Input value={filters.serie} onChange={e=>update('serie',e.target.value)} placeholder="Série exata"/></Field>
      <Field label="Setor" htmlFor="op-setor"><Input id="op-setor" list="op-setores" placeholder="Todos os autorizados" value={filters.setor} onChange={e=>update('setor',e.target.value)}/><datalist id="op-setores">{(user.perfil==='COORDENACAO'?['BOBINA AT','BOBINA BT','SOLDA','MONTAGEM FINAL','CORTE DO LASER','FERRAGEM','MONTAGEM DO NUCLEO','CORTE DO NUCLEO','BOBINAGEM EPOXI','ENCAPSULAMENTO']:authorized).map(s=><option key={s} value={s}/>)}</datalist></Field>
      <Field label="Linha"><Input value={filters.linha} onChange={e=>update('linha',e.target.value)} placeholder="MON, TRI, EPO..."/></Field>
      <Field label="Cliente"><Input value={filters.cliente} onChange={e=>update('cliente',e.target.value)} placeholder="Nome do cliente"/></Field>
      <Field label="Situação"><SelectField value={filters.situacao} onChange={e=>update('situacao',e.target.value)}><option value="ATRASADOS">Com atraso</option><option value="PENDENTES">Pendência vencida</option><option value="PRAZO_VENCIDO">Prazo vencido</option><option value="CONCLUIDOS">Concluídas</option><option value="TODOS">Todas</option></SelectField></Field>
      <Field label="Justificativa"><SelectField value={filters.justificativa} onChange={e=>update('justificativa',e.target.value)}><option value="">Todas</option><option value="SEM">Sem justificativa</option><option value="COM">Com justificativa</option></SelectField></Field>
      <Field label="Início"><DateInput value={filters.inicio} onChange={e=>update('inicio',e.target.value)}/></Field>
      <Field label="Fim"><DateInput value={filters.fim} onChange={e=>update('fim',e.target.value)}/></Field>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 self-end rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-sm font-medium text-slate-300"><input type="checkbox" className="size-4 accent-emerald-400" checked={filters.multiplos} onChange={e=>update('multiplos',e.target.checked)}/>Programadas em vários dias</label>
    </FilterPanel>
    <SectionCard title={`Resultados OP + setor: ${fmt(data?.total||0)}`} icon={<Search className="size-5" aria-hidden="true"/>} description="Selecione uma OP para consultar seus setores, séries, justificativas e histórico." actions={<span className="text-xs font-medium text-slate-400" aria-live="polite">{loading?'Atualizando...':`Página ${page} · ${rows.length} OP + setor exibidos`}</span>}>
      <div aria-busy={loading}>
        <DataTable columns={columns} rows={rows} getRowKey={r=>`${r.op}|${r.setor}`} caption="Produção e pendências por OP e setor" className="min-w-[72rem] text-xs" emptyState={<p className="py-8 text-center text-sm text-slate-400">{loading?'Carregando resultados...':'Nenhum registro neste filtro. Confira as importações ou amplie a situação.'}</p>}/>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500">{fmt(data?.total||0)} resultados · 50 por página</p><div className="flex gap-2"><Button variant="secondary" size="sm" disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</Button><Button variant="secondary" size="sm" disabled={loading||page*50>=(data?.total||0)} onClick={()=>setPage(p=>p+1)}>Próxima</Button></div></div>
      </div>
    </SectionCard>
    {selected&&<OpDetailModal key={`${selected.op}|${selected.setor}`} {...{selected,detail,history,detailError,motivo,previsao,saving,close,open,save,setMotivo,setPrevisao}}/>}
  </PageContainer>;
}
