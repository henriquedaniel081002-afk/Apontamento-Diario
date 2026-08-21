import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Box,
  CalendarDays,
  ClipboardList,
  Info,
  UsersRound,
} from 'lucide-react';
import type { DetalheProducao, Falta, Observacao } from '../components/DayDetailModal';
import { EpoxiDayDetailModal } from '../components/EpoxiDayDetailModal';

const fmt = (value: number) => Math.round(value).toLocaleString('pt-BR');
const fmtDate = (value: string) => {
  const [y,m,d] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d));
};

export function EpoxiDashboard({
  mes,
  turno,
  detalhes,
  faltas,
  observacoes,
}: {
  mes: string;
  turno: string;
  detalhes: DetalheProducao[];
  faltas: Falta[];
  observacoes: Observacao[];
}) {
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const calculado = useMemo(() => {
    const producao = detalhes.filter(r => r.data.startsWith(mes) && r.setor === 'EPOXI' && (!r.linha || r.linha === 'EPO'));
    const faltasFiltradas = faltas.filter(r => r.data.startsWith(mes) && r.setor === 'EPOXI' && (!r.linha || r.linha === 'EPO') && (turno === 'Todos' || r.turno === turno));
    const obs = observacoes.filter(r => r.data.startsWith(mes) && r.setor === 'EPOXI' && (!r.linha || r.linha === 'EPO'));
    const [ano, numeroMes] = mes.split('-').map(Number);
    const diasMes = new Date(ano, numeroMes, 0).getDate();
    const porDia = Array.from({length:diasMes},(_,i)=>{
      const data = `${mes}-${String(i+1).padStart(2,'0')}`;
      const produzido = producao.filter(r=>r.data===data).reduce((acc,r)=>acc+Number(r.quantidade||0),0);
      return {dia:String(i+1).padStart(2,'0'), data, produzido};
    });
    const totalProduzido = producao.reduce((acc,r)=>acc+Number(r.quantidade||0),0);
    const diasComProducao = new Set(producao.filter(r=>Number(r.quantidade||0)>0).map(r=>r.data)).size;
    const totalFaltas = faltasFiltradas.reduce((acc,r)=>acc+Number(r.quantidade||0),0);
    return { producao, faltasFiltradas, obs, porDia, totalProduzido, diasComProducao, totalFaltas };
  },[mes,turno,detalhes,faltas,observacoes]);

  const periodo = (() => {
    const [ano, numeroMes] = mes.split('-').map(Number);
    const diasMes = new Date(ano, numeroMes, 0).getDate();
    return `01/${String(numeroMes).padStart(2,'0')}/${ano} a ${String(diasMes).padStart(2,'0')}/${String(numeroMes).padStart(2,'0')}/${ano}`;
  })();

  return (
    <main className="epoxi-dashboard">
      <section className="epoxi-heading">
        <div>
          <div className="epoxi-title-line"><h2>EPOXI</h2><span>•</span><strong>Linha: EPO</strong></div>
          <p>Painel específico com produção, faltas e ocorrências do setor EPOXI.</p>
        </div>
        <div className="epoxi-data-note"><Info className="size-4"/><span>Dados exibidos somente para o setor <b>EPOXI</b> (Linha EPO).</span></div>
      </section>

      <section className="epoxi-kpis">
        <EpoxiKpi icon={Box} label="Produção total" value={fmt(calculado.totalProduzido)} suffix="unidades" tone="green" description="Total produzido no período" />
        <EpoxiKpi icon={CalendarDays} label="Dias com produção" value={fmt(calculado.diasComProducao)} suffix={calculado.diasComProducao === 1 ? 'dia' : 'dias'} tone="blue" description="Dias com pelo menos 1 registro de produção" />
        <EpoxiKpi icon={UsersRound} label="Total de faltas" value={fmt(calculado.totalFaltas)} suffix={calculado.totalFaltas === 1 ? 'falta' : 'faltas'} tone="purple" description={turno==='Todos'?'Total de faltas no período':`Faltas do ${turno} turno`} />
        <EpoxiKpi icon={AlertTriangle} label="Total de ocorrências" value={fmt(calculado.obs.length)} suffix="ocorrências" tone="orange" description="Ocorrências registradas no período" />
      </section>

      <section className="epoxi-chart-row">
        <article className="epoxi-panel epoxi-chart-panel">
          <div className="epoxi-panel-heading">
            <div><h3>Produção por dia</h3><p>Quantidade produzida por dia</p></div>
            <span className="epoxi-view-pill">Visualização: <b>Diária</b></span>
          </div>
          <div className="epoxi-chart-wrap overflow-x-auto">
            <div className="flex h-full min-w-[640px] items-end gap-1.5 px-2 pt-7">
              {calculado.porDia.map(item=>{
                const max=Math.max(1,...calculado.porDia.map(r=>r.produzido));
                const height=Math.max(item.produzido?6:0,(item.produzido/max)*155);
                return <button key={item.data} type="button" disabled={!item.produzido} onClick={()=>item.produzido>0&&setDiaSelecionado(item.data)} className="flex min-w-[24px] flex-1 flex-col items-center justify-end gap-1 rounded-md px-0.5 hover:bg-white/[0.03] disabled:cursor-default">
                  <div className="relative w-[70%] max-w-5 rounded-t-md bg-[#27d6a1] shadow-[0_0_12px_rgba(45,214,160,.24)]" style={{height,opacity:item.produzido>0?1:0}}>{item.produzido>0&&<span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-extrabold text-slate-200">{item.produzido}</span>}</div>
                  <span className="text-[8px] font-bold text-slate-400">{item.dia}</span>
                </button>;
              })}
            </div>
          </div>
          <div className="epoxi-chart-note"><Info className="size-3.5"/><span>Clique em uma coluna com produção para abrir os detalhes completos do dia.</span></div>
        </article>

        <article className="epoxi-panel epoxi-summary-panel">
          <div className="epoxi-panel-heading"><div><h3>Resumo do período</h3><p>Filtros aplicados ao painel</p></div></div>
          <div className="epoxi-summary-list">
            <div><span>Período selecionado</span><strong>{periodo}</strong></div>
            <div><span>Linha</span><strong className="epoxi-chip">EPO</strong></div>
            <div><span>Setor</span><strong className="epoxi-chip">EPOXI</strong></div>
            <div><span>Turno</span><strong>{turno}</strong></div>
          </div>
          <div className="epoxi-summary-foot"><Info className="size-3.5"/> Dados consolidados do mês selecionado.</div>
        </article>
      </section>

      <section className="epoxi-tables">
        <EpoxiTable title="Detalhes de produção" subtitle="Registros de produção do período" icon={ClipboardList} columns={['Data','Potência','Linha','Quantidade']} empty="Nenhum registro de produção no período.">
          {calculado.producao.map((r,i)=><div className="epoxi-table-row epoxi-table-row--production" key={`${r.data}-${r.potencia}-${i}`}><span>{fmtDate(r.data)}</span><span>{r.potencia} kVA</span><span>{r.linha}</span><strong>{fmt(Number(r.quantidade||0))}</strong></div>)}
        </EpoxiTable>

        <EpoxiTable title="Faltas" subtitle="Faltas registradas no período" icon={UsersRound} columns={['Data','Turno','Quantidade']} empty="Nenhuma falta registrada no período.">
          {calculado.faltasFiltradas.map((r,i)=><div className="epoxi-table-row epoxi-table-row--absence" key={`${r.data}-${r.turno}-${i}`}><span>{fmtDate(r.data)}</span><span>{r.turno} turno</span><strong>{fmt(Number(r.quantidade||0))}</strong></div>)}
        </EpoxiTable>

        <EpoxiTable title="Ocorrências / observações" subtitle="Ocorrências registradas no período" icon={AlertTriangle} columns={['Data','Descrição']} empty="Nenhuma ocorrência registrada no período.">
          {calculado.obs.map((r,i)=><div className="epoxi-table-row epoxi-table-row--notes" key={`${r.data}-${i}`}><span>{fmtDate(r.data)}</span><span>{r.observacao ?? r.texto ?? '—'}</span></div>)}
        </EpoxiTable>
      </section>

      {diaSelecionado && <EpoxiDayDetailModal data={diaSelecionado} detalhes={detalhes} faltas={faltas} observacoes={observacoes} turno={turno} onClose={()=>setDiaSelecionado(null)}/>}      
    </main>
  );
}

type IconType = typeof Box;
function EpoxiKpi({icon:Icon,label,value,suffix,tone,description}:{icon:IconType;label:string;value:string;suffix:string;tone:'green'|'blue'|'purple'|'orange';description:string}) {
  return <article className={`epoxi-kpi epoxi-kpi--${tone}`}>
    <div className="epoxi-kpi-icon"><Icon className="size-6"/></div>
    <div><span>{label}</span><div className="epoxi-kpi-value"><strong>{value}</strong><b>{suffix}</b></div><p>{description}</p></div>
  </article>;
}

function EpoxiTable({title,subtitle,icon:Icon,columns,children,empty}:{title:string;subtitle:string;icon:IconType;columns:string[];children:ReactNode;empty:string}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return <article className="epoxi-panel epoxi-table-card">
    <div className="epoxi-table-title"><Icon className="size-4"/><div><h3>{title}</h3><p>{subtitle}</p></div></div>
    <div className={`epoxi-table-head epoxi-table-head--${columns.length}`}>{columns.map(c=><span key={c}>{c}</span>)}</div>
    <div className="epoxi-table-body">{count ? children : <div className="epoxi-table-empty">{empty}</div>}</div>
  </article>;
}
