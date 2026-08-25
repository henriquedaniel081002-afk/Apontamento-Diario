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
import type { DetalheProducao, Falta, FaltaMaterial, MaquinaQuebrada, NaoConformidade, Observacao } from '../components/DayDetailModal';
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
  faltasMaterial = [],
  maquinasQuebradas = [],
  naoConformidades = [],
}: {
  mes: string;
  turno: string;
  detalhes: DetalheProducao[];
  faltas: Falta[];
  observacoes: Observacao[];
  faltasMaterial?: FaltaMaterial[];
  maquinasQuebradas?: MaquinaQuebrada[];
  naoConformidades?: NaoConformidade[];
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
    <section className="epoxi-dashboard" aria-label="Indicadores e detalhes do setor EPOXI">
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
        <EpoxiKpi icon={UsersRound} label="Total de faltas" value={fmt(calculado.totalFaltas)} suffix={calculado.totalFaltas === 1 ? 'falta' : 'faltas'} tone="danger" description={turno==='Todos'?'Total de faltas no período':`Faltas do ${turno} turno`} />
        <EpoxiKpi icon={AlertTriangle} label="Total de ocorrências" value={fmt(calculado.obs.length)} suffix="ocorrências" tone="orange" description="Ocorrências registradas no período" />
      </section>

      <section className="epoxi-chart-row">
        <article className="epoxi-panel epoxi-chart-panel">
          <div className="epoxi-panel-heading">
            <div><h3>Produção por dia</h3><p>Quantidade produzida por dia</p></div>
            <span className="epoxi-view-pill">Visualização: <b>Diária</b></span>
          </div>
          <div className="epoxi-chart-wrap overflow-x-auto">
            <div className="epoxi-bars" style={{ minWidth: `clamp(42rem, ${calculado.porDia.length * 2.75}rem, 92rem)` }}>
              {calculado.porDia.map(item=>{
                const max=Math.max(1,...calculado.porDia.map(r=>r.produzido));
                const height=Math.max(item.produzido?6:0,(item.produzido/max)*155);
                return <button key={item.data} type="button" disabled={!item.produzido} onClick={()=>item.produzido>0&&setDiaSelecionado(item.data)} className="epoxi-day-bar" aria-label={`${item.data}: ${fmt(item.produzido)} unidades produzidas${item.produzido>0?'. Abrir detalhes.':''}`}>
                  <div className="epoxi-day-bar__column" style={{height,opacity:item.produzido>0?1:0}} aria-hidden="true">{item.produzido>0&&<span>{item.produzido}</span>}</div>
                  <span className="epoxi-day-bar__label" aria-hidden="true">{item.dia}</span>
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
          {calculado.producao.map((r,i)=><tr key={`${r.data}-${r.potencia}-${i}`}><td>{fmtDate(r.data)}</td><td>{r.potencia} kVA</td><td>{r.linha}</td><td><strong>{fmt(Number(r.quantidade||0))}</strong></td></tr>)}
        </EpoxiTable>

        <EpoxiTable title="Faltas" subtitle="Faltas registradas no período" icon={UsersRound} columns={['Data','Turno','Quantidade']} empty="Nenhuma falta registrada no período.">
          {calculado.faltasFiltradas.map((r,i)=><tr key={`${r.data}-${r.turno}-${i}`}><td>{fmtDate(r.data)}</td><td>{r.turno} turno</td><td><strong>{fmt(Number(r.quantidade||0))}</strong></td></tr>)}
        </EpoxiTable>

        <EpoxiTable title="Ocorrências / observações" subtitle="Ocorrências registradas no período" icon={AlertTriangle} columns={['Data','Descrição']} empty="Nenhuma ocorrência registrada no período.">
          {calculado.obs.map((r,i)=><tr key={`${r.data}-${i}`}><td>{fmtDate(r.data)}</td><td>{r.observacao ?? r.texto ?? '—'}</td></tr>)}
        </EpoxiTable>
      </section>

      {diaSelecionado && <EpoxiDayDetailModal data={diaSelecionado} detalhes={detalhes} faltas={faltas} observacoes={observacoes} faltasMaterial={faltasMaterial} maquinasQuebradas={maquinasQuebradas} naoConformidades={naoConformidades} turno={turno} onClose={()=>setDiaSelecionado(null)}/>}      
    </section>
  );
}

type IconType = typeof Box;
function EpoxiKpi({icon:Icon,label,value,suffix,tone,description}:{icon:IconType;label:string;value:string;suffix:string;tone:'green'|'blue'|'danger'|'orange';description:string}) {
  return <article className={`epoxi-kpi epoxi-kpi--${tone}`}>
    <div className="epoxi-kpi-icon"><Icon className="size-6"/></div>
    <div><span>{label}</span><div className="epoxi-kpi-value"><strong>{value}</strong><b>{suffix}</b></div><p>{description}</p></div>
  </article>;
}

function EpoxiTable({title,subtitle,icon:Icon,columns,children,empty}:{title:string;subtitle:string;icon:IconType;columns:string[];children:ReactNode;empty:string}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return <article className="epoxi-panel epoxi-table-card">
    <div className="epoxi-table-title"><Icon className="size-4"/><div><h3>{title}</h3><p>{subtitle}</p></div></div>
    <div className="epoxi-table-scroll" tabIndex={0} role="region" aria-label={title}>
      <table className="epoxi-table">
        <thead><tr>{columns.map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead>
        <tbody>{count ? children : <tr><td className="epoxi-table-empty" colSpan={columns.length}>{empty}</td></tr>}</tbody>
      </table>
    </div>
  </article>;
}
