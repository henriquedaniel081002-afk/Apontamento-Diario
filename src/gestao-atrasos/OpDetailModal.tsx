import { useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardList, ClockAlert, History as HistoryIcon, Layers3, ListChecks, Save, Table2 } from 'lucide-react';
import { ModalShell } from '../components/common/ModalShell';
import { Badge, Button, DataTable, DateInput, Field, MetricCard, Surface, type BadgeVariant, type DataTableColumn } from '../components/common/ui';
import {fmt,br,situation,type Row,type Series,type Progress,type History} from './presentation';

type Props={selected:Row;detail:{series:Series[];progresso:Progress[];apontamentoImportado:boolean}|null;history:History[];detailError:string;motivo:string;previsao:string;saving:boolean;close:()=>void;open:(row:Row)=>Promise<void>;save:()=>Promise<void>;setMotivo:(v:string)=>void;setPrevisao:(v:string)=>void};
type Tab='resumo'|'setores'|'series'|'justificativa'|'historico';
const tabs:{id:Tab;label:string;icon:typeof ClipboardList}[]=[
  {id:'resumo',label:'Resumo',icon:ClipboardList},
  {id:'setores',label:'Setores',icon:Layers3},
  {id:'series',label:'Séries e datas',icon:Table2},
  {id:'justificativa',label:'Observação',icon:ListChecks},
  {id:'historico',label:'Histórico',icon:HistoryIcon},
];
const seriesTone=(s:Series):BadgeVariant=>{
  if(s.situacao==='PENDENTE_VENCIDO'||s.situacao==='PRODUZIDO_ATRASADO')return 'danger';
  if(s.situacao==='PENDENTE_NO_PRAZO')return 'warning';
  if(s.situacao==='PRODUZIDO_NO_PRAZO')return 'success';
  return 'neutral';
};

export function OpDetailModal({selected,detail,history,detailError,motivo,previsao,saving,close,open,save,setMotivo,setPrevisao}:Props){
  const [tab,setTab]=useState<Tab>('resumo');
  const byDate=useMemo(()=> (detail?.series||[]).reduce<Record<string,{programados:number;produzidos:number;vencidos:number}>>((acc,s)=>{
    const row=acc[s.data_programada]??{programados:0,produzidos:0,vencidos:0};row.programados++;if(s.data_produzida)row.produzidos++;if(s.situacao==='PENDENTE_VENCIDO')row.vencidos++;acc[s.data_programada]=row;return acc;
  },{}),[detail]);
  const percent=Math.round(100*(selected.produzidos??0)/Math.max(1,selected.programados));
  const progressColumns:DataTableColumn<Progress>[]=[
    {id:'setor',header:'Setor',cell:p=><span className={`font-bold ${p.setor===selected.setor?'text-emerald-300':'text-slate-100'}`}>{p.setor}</span>},
    {id:'programados',header:'Programado',align:'right',cell:p=><span className="tabular-nums">{fmt(p.programados)}</span>},
    {id:'produzidos',header:'Produzido',align:'right',cell:p=><span className="font-semibold tabular-nums text-emerald-300">{detail?.apontamentoImportado?fmt(p.produzidos):'—'}</span>},
    {id:'vencidos',header:'Vencidos',align:'right',cell:p=><span className={`font-bold tabular-nums ${p.pendentes_vencidos?'text-rose-300':'text-slate-300'}`}>{detail?.apontamentoImportado?fmt(p.pendentes_vencidos):'—'}</span>},
    {id:'progresso',header:'Progresso',cell:p=>{const value=Math.round(100*(p.produzidos??0)/Math.max(1,p.programados));return <div className="flex min-w-28 items-center gap-3"><span className="w-10 font-bold tabular-nums text-white">{detail?.apontamentoImportado?`${value}%`:'—'}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{width:`${Math.min(100,value)}%`}}/></div></div>;}},
  ];
  const seriesColumns:DataTableColumn<Series>[]=[
    {id:'programada',header:'Data programada',cell:s=><span className="tabular-nums">{br(s.data_programada)}</span>},
    {id:'serie',header:'Série',cell:s=><span className="font-mono font-bold tabular-nums text-white">{s.serie}</span>},
    {id:'produzida',header:'Produzida em',cell:s=><span className="tabular-nums">{br(s.data_produzida)}</span>},
    {id:'situacao',header:'Situação',cell:s=><Badge variant={detail?.apontamentoImportado?seriesTone(s):'neutral'}>{detail?.apontamentoImportado?(situation[s.situacao]||s.situacao):'Produção sem dados'}</Badge>},
  ];
  return <ModalShell isOpen onClose={close} title={`Detalhamento da OP ${selected.op}`} description="Acompanhamento integrado de produção, pendências, observações e prazos." size="2xl" busy={saving}>
    <nav aria-label="Seções da OP" className="mb-5 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4">
      {tabs.map(({id,label,icon:Icon})=><button type="button" key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${tab===id?'border-emerald-400/50 bg-emerald-400/15 text-emerald-200':'border-white/10 bg-white/[0.035] text-slate-400 hover:border-white/20 hover:bg-white/[0.075] hover:text-white'}`}><Icon className="size-4" aria-hidden="true"/>{label}</button>)}
    </nav>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">{selected.setor} · {selected.linha} · {selected.cliente||'Cliente não informado'}</p>
        <p className="mt-1 text-sm text-slate-300">Potência: <strong className="text-white">{selected.potencia||'Não informada'}</strong> · Programação: <span className="tabular-nums">{br(selected.data_programada)} · Ref. {selected.referencia||"—"}</span></p>
      </div>
      <Badge variant={selected.pendentes_vencidos?'danger':'neutral'}>{situation[selected.situacao]||selected.situacao}</Badge>
    </div>
    {detailError&&<div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] p-3 text-sm text-rose-200"><span>{detailError}</span><Button variant="secondary" size="sm" onClick={()=>void open(selected)}>Tentar novamente</Button></div>}
    {!detail?(detailError?null:<p className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400" role="status">Carregando detalhamento...</p>):<>
      <section hidden={tab!=='resumo'}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard label="Programado no dia" value={fmt(selected.programados)} icon={<CalendarClock className="size-5" aria-hidden="true"/>} tone="info"/>
          <MetricCard label="Produzido do grupo" value={detail.apontamentoImportado?fmt(selected.produzidos):'—'} icon={<CheckCircle2 className="size-5" aria-hidden="true"/>} tone="success"/>
          <MetricCard label="Pendente do grupo" value={detail.apontamentoImportado&&selected.produzidos!==null?fmt(selected.programados-selected.produzidos):'—'} icon={<ClockAlert className="size-5" aria-hidden="true"/>} tone="danger"/>
          <MetricCard label="Progresso" value={detail.apontamentoImportado?`${percent}%`:'—'} icon={<Layers3 className="size-5" aria-hidden="true"/>} tone="info"/>
        </div>
        <h3 className="mt-6 text-base font-extrabold text-white">Progresso dos setores em toda a programação · {fmt(detail.progresso[0]?.quantidade_op||0)} séries distintas na OP</h3>
        {!detail.apontamentoImportado&&<p className="mt-1 text-sm text-amber-200">Arquivo de apontamentos ainda não importado; produção indisponível.</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{detail.progresso.map(p=>{
          const pPercent=Math.round(100*(p.produzidos??0)/Math.max(1,p.programados));
          return <Surface key={p.setor} padding="sm" tone="muted" className={p.setor===selected.setor?'border-emerald-400/35':''}>
            <div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-extrabold uppercase tracking-wide text-slate-200" title={p.setor}>{p.setor}</p>{p.setor===selected.setor&&<Badge variant="success">Selecionado</Badge>}</div>
            <div className="mt-2 flex items-end justify-between gap-2"><p className="text-xs text-slate-400">{detail.apontamentoImportado?`${fmt(p.produzidos)} / ${fmt(p.programados)} produzidos`:`${fmt(p.programados)} programados`}</p><span className="text-lg font-black tabular-nums text-white">{detail.apontamentoImportado?`${pPercent}%`:'—'}</span></div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{width:`${Math.min(100,pPercent)}%`}}/></div>
            <p className={`mt-2 text-xs ${p.pendentes_vencidos?'text-rose-300':'text-slate-500'}`}>{detail.apontamentoImportado?`${fmt(p.pendentes_vencidos)} pendentes vencidos`:'Produção indisponível'}</p>
          </Surface>;
        })}</div>
      </section>
      <section hidden={tab!=='setores'}>
        <h3 className="text-base font-extrabold text-white">Progresso de todos os setores</h3><p className="mb-3 mt-1 text-sm text-slate-400">Toda a programação ativa da OP, inclusive fora da data selecionada.</p>
        <DataTable columns={progressColumns} rows={detail.progresso} getRowKey={p=>p.setor} caption="Produção por setor" className="min-w-[40rem]"/>
      </section>
      <section hidden={tab!=='series'}>
        <h3 className="text-base font-extrabold text-white">Programações por data · {selected.setor}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(byDate).map(([date,v])=><Surface key={date} padding="sm" tone="muted"><p className="text-sm font-extrabold tabular-nums text-white">{br(date)}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"><span className="text-sky-300">{fmt(v.programados)} programados</span><span className="text-emerald-300">{detail.apontamentoImportado?fmt(v.produzidos):'—'} produzidos</span><span className={v.vencidos?'text-rose-300':'text-slate-400'}>{detail.apontamentoImportado?fmt(v.vencidos):'—'} pendentes vencidos</span></div></Surface>)}</div>
        <h3 className="mt-6 text-base font-extrabold text-white">Programação e séries do seu setor</h3>
        <p className="mb-3 mt-1 text-xs text-slate-400">{detail.apontamentoImportado?'Produção sem registro no arquivo importado aparece como pendente.':'Arquivo de apontamentos ainda não importado; produção indisponível.'}</p>
        <div className="max-h-96 overflow-y-auto rounded-2xl border border-white/10"><DataTable columns={seriesColumns} rows={detail.series} getRowKey={s=>`${s.serie}|${s.data_programada}`} caption="Séries e datas programadas" className="min-w-[37rem] text-xs" containerClassName="rounded-none border-0"/></div>
      </section>
    </>}
    <section hidden={tab!=='justificativa'}>
      <Surface padding="md" tone="muted">
        <h3 className="text-base font-extrabold text-white">Observação e prazo · {selected.setor}</h3><p className="mb-5 mt-1 text-sm text-slate-400">O registro vale para todas as datas desta OP neste setor e preserva o histórico.</p>
        <div className="space-y-4"><Field label="Observação" required hint="Informe ao menos cinco caracteres."><textarea className="field-control min-h-28 resize-y" maxLength={3000} value={motivo} onChange={e=>setMotivo(e.target.value)}/></Field><Field label="Previsão de regularização (opcional)"><DateInput value={previsao} onChange={e=>setPrevisao(e.target.value)}/></Field></div>
        <div className="mt-5 flex justify-end"><Button variant="primary" leftIcon={<Save className="size-4" aria-hidden="true"/>} disabled={!detail||saving||motivo.trim().length<5} isLoading={saving} loadingLabel="Salvando..." onClick={()=>void save()}>Registrar observação</Button></div>
      </Surface>
    </section>
    <section hidden={tab!=='historico'}>
      <h3 className="text-base font-extrabold text-white">Histórico ({history.length})</h3><p className="mb-3 mt-1 text-sm text-slate-400">Registros anteriores de observação e previsão de regularização.</p>
      <div className="max-h-80 space-y-3 overflow-y-auto">{history.map(h=><Surface key={h.id} padding="sm" tone="muted"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">{h.motivo}</p><p className="mt-2 text-xs text-slate-400">{h.responsavel} · {new Date(h.criado_em).toLocaleString('pt-BR')} · Prazo: <span className="font-semibold text-slate-200">{br(h.previsao_regularizacao)}</span></p></Surface>)}{!history.length&&<p className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-slate-400">Nenhum registro anterior.</p>}</div>
    </section>
  </ModalShell>;
}
