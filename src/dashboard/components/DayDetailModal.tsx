import { useState } from 'react';
import {
  AlertTriangle,
  BadgeAlert,
  CalendarDays,
  Factory,
  Gauge,
  LayoutDashboard,
  PackageX,
  UserRound,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { ModalShell } from '../../components/common/ModalShell';
import type { EvolutionItem } from './Charts';

export type DetalheProducao = { data:string; linha:string; setor:string; potencia:number|string; quantidade:number; turno?:string };
export type Falta = { data:string; linha:string; setor:string; turno:string; quantidade:number };
export type Observacao = { data:string; linha:string; setor:string; turno?:string; observacao?:string; texto?:string; justificativaMeta?:string };
export type DetalheFalta = {
  data:string;
  nome?:string;
  motivoJustificativa?:string;
  atestado?:string;
  quantidade?:number|null;
  turno?:string;
  setor:string;
  linha?:string;
};
export type DetalheObservacao = {
  data:string;
  linha?:string;
  setor:string;
  observacao?:string;
  texto?:string;
  justificativaMeta?:string;
  turno?:string;
};
export type FaltaMaterial = {
  data:string;
  causaMotivo?:string;
  material?:string;
  horaInicio?:string;
  horaFim?:string;
  turno?:string;
  setor:string;
};
export type MaquinaQuebrada = {
  data:string;
  maquinaEquipamento?:string;
  horaInicio?:string;
  horaFim?:string;
  observacao?:string;
  turno?:string;
  setor:string;
};
export type NaoConformidade = {
  data:string;
  causa?:string;
  op?:string;
  numeroSerie?:string;
  turno?:string;
  setor:string;
};

type TabId = 'resumo' | 'producao' | 'faltas' | 'ocorrencias' | 'material' | 'maquinas' | 'nao-conformidades';

const fmt = (n:number) => Math.round(n).toLocaleString('pt-BR');
const pct = (n:number) => `${n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
const formatDate = (value:string) => {
  const [y,m,d]=value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(y,m-1,d));
};
const display = (value:unknown, fallback='Não informado') => {
  if (value === null || value === undefined) return fallback;
  const text=String(value).trim();
  return text || fallback;
};
const durationLabel = (inicio?:string, fim?:string) => {
  if (!inicio || !fim) return '';
  const parse=(value:string) => {
    const [h,m]=value.split(':').map(Number);
    return Number.isFinite(h)&&Number.isFinite(m) ? h*60+m : null;
  };
  const start=parse(inicio);
  let end=parse(fim);
  if (start===null || end===null) return '';
  if (end<start) end+=24*60;
  const total=end-start;
  const horas=Math.floor(total/60);
  const minutos=total%60;
  if (!total) return '0 min';
  if (!horas) return `${minutos} min`;
  return minutos ? `${horas}h ${minutos}min` : `${horas}h`;
};

export function DayDetailModal({
  item,
  setor,
  linha,
  turno,
  detalhes,
  faltas,
  observacoes,
  detalhesFaltas = [],
  detalhesObservacoes = [],
  faltasMaterial = [],
  maquinasQuebradas = [],
  naoConformidades = [],
  onClose,
}:{
  item:EvolutionItem;
  setor:string;
  linha:string;
  turno:string;
  detalhes:DetalheProducao[];
  faltas:Falta[];
  observacoes:Observacao[];
  detalhesFaltas?:DetalheFalta[];
  detalhesObservacoes?:DetalheObservacao[];
  faltasMaterial?:FaltaMaterial[];
  maquinasQuebradas?:MaquinaQuebrada[];
  naoConformidades?:NaoConformidade[];
  onClose:()=>void;
}) {
  const [activeTab,setActiveTab]=useState<TabId>('resumo');
  const diferenca=item.produzido-item.programado;
  const aderencia=item.programado ? item.produzido/item.programado*100 : null;

  // Mantém cada combinação Potência + Linha separada. Isso preserva a regra
  // existente e evita misturar, por exemplo, 30 kVA MON com 30 kVA TRI.
  const potencias = detalhes
    .filter(r=>r.data===item.data && r.setor===setor && (linha==='Todas'||!r.linha||r.linha===linha) && (turno==='Todos'||r.turno===turno))
    .reduce<Map<string,{potencia:string;linha:string;turno?:string;quantidade:number}>>((acc,r)=>{
      const potencia=String(r.potencia);
      const chave=`${potencia}||${r.linha}||${r.turno||''}`;
      const atual=acc.get(chave);
      acc.set(chave,{potencia,linha:r.linha,turno:r.turno,quantidade:(atual?.quantidade||0)+Number(r.quantidade||0)});
      return acc;
    },new Map());
  const potenciaRows=[...potencias.values()].sort((a,b)=>{
    const dif=Number(a.potencia.replace(',','.'))-Number(b.potencia.replace(',','.'));
    return dif!==0?dif:a.linha.localeCompare(b.linha,'pt-BR')||String(a.turno||'').localeCompare(String(b.turno||''),'pt-BR');
  });

  // A estrutura antiga continua sendo usada para o total por turno.
  const faltasDia=faltas.filter(r=>r.data===item.data && r.setor===setor && (linha==='Todas'||!r.linha||r.linha===linha) && (turno==='Todos'||r.turno===turno));
  const obsDia=observacoes.filter(r=>r.data===item.data && r.setor===setor && (linha==='Todas'||!r.linha||r.linha===linha) && (turno==='Todos'||!r.turno||r.turno===turno));

  // Estruturas novas são opcionais. JSONs antigos funcionam normalmente.
  const detalhesFaltasDia=detalhesFaltas.filter(r=>
    r.data===item.data &&
    r.setor===setor &&
    (linha==='Todas'||!r.linha||r.linha===linha) &&
    (turno==='Todos'||!r.turno||r.turno===turno)
  );
  const detalhesObsDia=detalhesObservacoes.filter(r=>
    r.data===item.data && r.setor===setor && (linha==='Todas'||!r.linha||r.linha===linha) &&
    (turno==='Todos'||!r.turno||r.turno===turno)
  );
  const ocorrenciasDia:DetalheObservacao[] = detalhesObsDia.length ? detalhesObsDia : obsDia;

  // Estas fontes não possuem campo linha no JSON; por isso respeitam data + setor.
  const materialDia=faltasMaterial.filter(r=>r.data===item.data && r.setor===setor && (turno==='Todos'||!r.turno||r.turno===turno));
  const maquinasDia=maquinasQuebradas.filter(r=>r.data===item.data && r.setor===setor && (turno==='Todos'||!r.turno||r.turno===turno));
  const ncDia=naoConformidades.filter(r=>r.data===item.data && r.setor===setor && (turno==='Todos'||!r.turno||r.turno===turno));

  const totalFaltas=faltasDia.reduce((sum,r)=>sum+Number(r.quantidade||0),0);
  const totalDetalhado=potenciaRows.reduce((a,r)=>a+r.quantidade,0);

  const tabs:{id:TabId;label:string;icon:typeof LayoutDashboard;count?:number}[]=[
    {id:'resumo',label:'Resumo',icon:LayoutDashboard},
    {id:'producao',label:'Produção',icon:Gauge,count:potenciaRows.length},
    {id:'faltas',label:'Faltas',icon:UsersRound,count:detalhesFaltasDia.length||faltasDia.length},
    {id:'ocorrencias',label:'Ocorrências',icon:AlertTriangle,count:ocorrenciasDia.length},
    {id:'material',label:'Falta de Material',icon:PackageX,count:materialDia.length},
    {id:'maquinas',label:'Máquinas',icon:Wrench,count:maquinasDia.length},
    {id:'nao-conformidades',label:'Não Conformidades',icon:BadgeAlert,count:ncDia.length},
  ];

  const ProductionCard=({full=false}:{full?:boolean}) => <article className={`day-detail-card day-detail-production${full?' day-detail-card--full':''}`}>
    <div className="day-detail-card-title"><Gauge className="size-4"/><div><h3>Produção por potência</h3><p>Composição do volume produzido no dia</p></div><b>{fmt(totalDetalhado)}</b></div>
    {potenciaRows.length ? <div className="day-detail-table-scroll" tabIndex={0} role="region" aria-label="Produção por potência">
      <table className="day-detail-table">
        <thead><tr><th scope="col">Potência</th><th scope="col" className="day-detail-line">Linha</th><th scope="col">Turno</th><th scope="col">Produzido</th></tr></thead>
        <tbody>{potenciaRows.map(r=><tr key={`${r.potencia}-${r.linha}-${r.turno||'sem-turno'}`}><td>{r.potencia} kVA</td><td className="day-detail-line">{r.linha}</td><td>{r.turno ? `${r.turno} turno` : '—'}</td><td><strong>{fmt(r.quantidade)}</strong></td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Total detalhado</th><td/><td/><td><strong>{fmt(totalDetalhado)}</strong></td></tr></tfoot>
      </table>
    </div> : <Empty text="Nenhum detalhamento por potência registrado para este dia."/>}
  </article>;

  return <ModalShell
    isOpen
    onClose={onClose}
    size="2xl"
    title={formatDate(item.data)}
    description={`${setor} • ${linha==='Todas'?'Todas as linhas':linha}${turno!=='Todos'?` • ${turno} turno`:''}`}
    closeLabel="Fechar detalhamento diário"
    className="day-detail-modal"
    footer={<footer className="day-detail-footer"><Factory className="size-3.5" aria-hidden="true"/> Dados consolidados para os filtros selecionados no dashboard.</footer>}
  >
    <section aria-label="Detalhamento diário">
      <span className="day-detail-eyebrow"><CalendarDays className="size-4" aria-hidden="true"/> Detalhamento diário</span>
      <div className="day-detail-body">
        <div className="day-detail-kpis">
          <article><span>Programado</span><strong>{fmt(item.programado)}</strong></article>
          <article><span>Produzido</span><strong>{fmt(item.produzido)}</strong></article>
          <article><span>Diferença</span><strong className={diferenca>=0?'positive':'negative'}>{diferenca>0?'+':''}{fmt(diferenca)}</strong></article>
          <article><span>Aderência</span><strong className={(aderencia||0)>=100?'positive':'negative'}>{aderencia===null?'—':pct(aderencia)}</strong></article>
        </div>

        <nav className="day-detail-tabs" role="tablist" aria-label="Seções do detalhamento diário">
          {tabs.map(tab=>{
            const Icon=tab.icon;
            const selected=activeTab===tab.id;
            return <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={selected?'active':''}
              onClick={()=>setActiveTab(tab.id)}
              onKeyDown={(event)=>{
                if (event.key!=='ArrowRight' && event.key!=='ArrowLeft' && event.key!=='Home' && event.key!=='End') return;
                event.preventDefault();
                const current=tabs.findIndex(item=>item.id===tab.id);
                const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(current+1)%tabs.length:(current-1+tabs.length)%tabs.length;
                setActiveTab(tabs[next].id);
                const buttons=event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                buttons?.[next]?.focus();
              }}
            >
              <Icon className="size-3.5"/>
              <span>{tab.label}</span>
              {!!tab.count && <b>{tab.count}</b>}
            </button>;
          })}
        </nav>

        <div className="day-detail-tab-panel" role="tabpanel">
          {activeTab==='resumo' && <div className="day-detail-grid day-detail-summary-grid">
            <ProductionCard/>
            <div className="day-detail-side">
              <article className="day-detail-card">
                <div className="day-detail-card-title"><UsersRound className="size-4"/><div><h3>Faltas</h3><p>Registros por turno</p></div><b>{fmt(totalFaltas)}</b></div>
                {faltasDia.length ? <div className="day-detail-list">{faltasDia.map((r,i)=><div key={`${r.turno}-${i}`}><span>{r.turno} turno</span><strong>{fmt(r.quantidade)}</strong></div>)}</div> : <Empty text="Nenhuma falta registrada."/>}
              </article>
              <article className="day-detail-card">
                <div className="day-detail-card-title"><AlertTriangle className="size-4"/><div><h3>Ocorrências</h3><p>Observações operacionais do dia</p></div><b>{ocorrenciasDia.length}</b></div>
                {ocorrenciasDia.length ? <div className="day-detail-notes">{ocorrenciasDia.slice(0,3).map((r,i)=><div className="day-detail-note" key={`${r.linha||'sem-linha'}-${i}`}>
                  <span>{r.turno ? `${r.turno} turno · ` : ''}{r.linha||'GERAL'}</span>
                  {r.observacao||r.texto ? <p>{r.observacao ?? r.texto}</p> : null}
                  {r.justificativaMeta ? <small><b>Justificativa da meta:</b> {r.justificativaMeta}</small> : null}
                </div>)}</div> : <Empty text="Nenhuma ocorrência registrada."/>}
              </article>
            </div>
            <article className="day-detail-card day-detail-event-summary">
              <div className="day-detail-event-summary-item"><PackageX className="size-4"/><span>Falta de material</span><strong>{materialDia.length}</strong></div>
              <div className="day-detail-event-summary-item"><Wrench className="size-4"/><span>Máquinas</span><strong>{maquinasDia.length}</strong></div>
              <div className="day-detail-event-summary-item"><BadgeAlert className="size-4"/><span>Não conformidades</span><strong>{ncDia.length}</strong></div>
            </article>
          </div>}

          {activeTab==='producao' && <div className="day-detail-single"><ProductionCard full/></div>}

          {activeTab==='faltas' && <div className="day-detail-single">
            <article className="day-detail-card day-detail-card--full">
              <div className="day-detail-card-title"><UsersRound className="size-4"/><div><h3>Detalhes das faltas</h3><p>Colaborador, motivo, atestado, quantidade e turno</p></div><b>{detalhesFaltasDia.length||faltasDia.length}</b></div>
              {detalhesFaltasDia.length ? <div className="day-detail-records">
                {detalhesFaltasDia.map((r,i)=><div className="day-detail-record" key={`${r.nome||'falta'}-${i}`}>
                  <div className="day-detail-record-heading"><span className="day-detail-record-icon"><UserRound className="size-4"/></span><div><h4>{display(r.nome,'Colaborador não informado')}</h4><p>{display(r.linha,'Linha não informada')} {r.turno ? `• ${r.turno} turno` : ''}</p></div>{r.quantidade!==null&&r.quantidade!==undefined ? <strong>{fmt(Number(r.quantidade))}</strong> : null}</div>
                  <div className="day-detail-record-fields">
                    <div><span>Motivo / justificativa</span><p>{display(r.motivoJustificativa)}</p></div>
                    <div><span>Atestado</span><p>{display(r.atestado)}</p></div>
                  </div>
                </div>)}
              </div> : faltasDia.length ? <div className="day-detail-fallback">
                <p>Este registro foi gerado por uma base anterior e não possui os novos dados individuais.</p>
                <div className="day-detail-list">{faltasDia.map((r,i)=><div key={`${r.turno}-${i}`}><span>{r.turno} turno</span><strong>{fmt(r.quantidade)}</strong></div>)}</div>
              </div> : <Empty text="Nenhuma falta registrada para os filtros selecionados."/>}
            </article>
          </div>}

          {activeTab==='ocorrencias' && <div className="day-detail-single">
            <article className="day-detail-card day-detail-card--full">
              <div className="day-detail-card-title"><AlertTriangle className="size-4"/><div><h3>Ocorrências e justificativas</h3><p>Observações operacionais e justificativa por não atingir a meta</p></div><b>{ocorrenciasDia.length}</b></div>
              {ocorrenciasDia.length ? <div className="day-detail-records day-detail-records--notes">
                {ocorrenciasDia.map((r,i)=><div className="day-detail-record day-detail-record--note" key={`${r.linha||'obs'}-${i}`}>
                  <div className="day-detail-record-heading"><span className="day-detail-line-badge">{r.linha||'GERAL'}</span><div><h4>Registro operacional</h4><p>{setor}{r.turno ? ` • ${r.turno} turno` : ''}</p></div></div>
                  <div className="day-detail-record-fields day-detail-record-fields--stack">
                    <div><span>Observação</span><p>{display(r.observacao ?? r.texto,'Nenhuma observação informada')}</p></div>
                    <div><span>Justificativa da meta</span><p>{display(r.justificativaMeta,'Nenhuma justificativa informada')}</p></div>
                  </div>
                </div>)}
              </div> : <Empty text="Nenhuma ocorrência ou justificativa registrada."/>}
            </article>
          </div>}

          {activeTab==='material' && <div className="day-detail-single">
            <article className="day-detail-card day-detail-card--full">
              <div className="day-detail-card-title"><PackageX className="size-4"/><div><h3>Falta de material</h3><p>Materiais indisponíveis e intervalo da ocorrência</p></div><b>{materialDia.length}</b></div>
              {materialDia.length ? <div className="day-detail-records">
                {materialDia.map((r,i)=>{
                  const duracao=durationLabel(r.horaInicio,r.horaFim);
                  return <div className="day-detail-record" key={`${r.material||'material'}-${i}`}>
                    <div className="day-detail-record-heading"><span className="day-detail-record-icon"><PackageX className="size-4"/></span><div><h4>{display(r.material,'Material não informado')}</h4><p>Registro por setor • {setor}{r.turno ? ` • ${r.turno} turno` : ''}</p></div>{duracao ? <strong className="day-detail-duration">{duracao}</strong> : null}</div>
                    <div className="day-detail-record-fields day-detail-record-fields--3">
                      <div><span>Causa / motivo</span><p>{display(r.causaMotivo)}</p></div>
                      <div><span>Início</span><p>{display(r.horaInicio)}</p></div>
                      <div><span>Fim</span><p>{display(r.horaFim)}</p></div>
                    </div>
                  </div>;
                })}
              </div> : <Empty text="Nenhuma falta de material registrada para este dia e setor."/>}
            </article>
          </div>}

          {activeTab==='maquinas' && <div className="day-detail-single">
            <article className="day-detail-card day-detail-card--full">
              <div className="day-detail-card-title"><Wrench className="size-4"/><div><h3>Máquinas / equipamentos</h3><p>Paradas registradas no setor</p></div><b>{maquinasDia.length}</b></div>
              {maquinasDia.length ? <div className="day-detail-records">
                {maquinasDia.map((r,i)=>{
                  const duracao=durationLabel(r.horaInicio,r.horaFim);
                  return <div className="day-detail-record" key={`${r.maquinaEquipamento||'maquina'}-${i}`}>
                    <div className="day-detail-record-heading"><span className="day-detail-record-icon"><Wrench className="size-4"/></span><div><h4>{display(r.maquinaEquipamento,'Máquina não informada')}</h4><p>Registro por setor • {setor}{r.turno ? ` • ${r.turno} turno` : ''}</p></div>{duracao ? <strong className="day-detail-duration">{duracao}</strong> : null}</div>
                    <div className="day-detail-record-fields day-detail-record-fields--3">
                      <div><span>Observação</span><p>{display(r.observacao)}</p></div>
                      <div><span>Início</span><p>{display(r.horaInicio)}</p></div>
                      <div><span>Fim</span><p>{display(r.horaFim)}</p></div>
                    </div>
                  </div>;
                })}
              </div> : <Empty text="Nenhuma parada de máquina ou equipamento registrada para este dia e setor."/>}
            </article>
          </div>}

          {activeTab==='nao-conformidades' && <div className="day-detail-single">
            <article className="day-detail-card day-detail-card--full">
              <div className="day-detail-card-title"><BadgeAlert className="size-4"/><div><h3>Não conformidades</h3><p>Ocorrências relacionadas a OP e número de série</p></div><b>{ncDia.length}</b></div>
              {ncDia.length ? <div className="day-detail-records">
                {ncDia.map((r,i)=><div className="day-detail-record" key={`${r.op||'nc'}-${r.numeroSerie||i}`}>
                  <div className="day-detail-record-heading"><span className="day-detail-record-icon"><BadgeAlert className="size-4"/></span><div><h4>{display(r.causa,'Causa não informada')}</h4><p>Registro por setor • {setor}{r.turno ? ` • ${r.turno} turno` : ''}</p></div></div>
                  <div className="day-detail-record-fields">
                    <div><span>OP</span><p>{display(r.op)}</p></div>
                    <div><span>Número de série</span><p>{display(r.numeroSerie)}</p></div>
                  </div>
                </div>)}
              </div> : <Empty text="Nenhuma não conformidade registrada para este dia e setor."/>}
            </article>
          </div>}
        </div>
      </div>
    </section>
  </ModalShell>;
}

function Empty({text}:{text:string}){return <div className="day-detail-empty">{text}</div>}
