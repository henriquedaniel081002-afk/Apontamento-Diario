import { AlertTriangle, Box, CalendarDays, UsersRound, X } from 'lucide-react';
import type { DetalheProducao, Falta, Observacao } from './DayDetailModal';

const fmt = (value:number) => Math.round(value).toLocaleString('pt-BR');
const formatDate = (value:string) => {
  const [y,m,d]=value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(y,m-1,d));
};

export function EpoxiDayDetailModal({data,detalhes,faltas,observacoes,turno,onClose}:{
  data:string;
  detalhes:DetalheProducao[];
  faltas:Falta[];
  observacoes:Observacao[];
  turno:string;
  onClose:()=>void;
}) {
  const producao = detalhes.filter(r=>r.data===data && r.setor==='EPOXI' && (!r.linha || r.linha==='EPO'));
  const faltasDia = faltas.filter(r=>r.data===data && r.setor==='EPOXI' && (!r.linha || r.linha==='EPO') && (turno==='Todos'||r.turno===turno));
  const obsDia = observacoes.filter(r=>r.data===data && r.setor==='EPOXI' && (!r.linha || r.linha==='EPO'));
  const potencias = [...producao.reduce<Map<string,{potencia:string;quantidade:number}>>((acc,r)=>{
    const key=String(r.potencia);
    const atual=acc.get(key);
    acc.set(key,{potencia:key,quantidade:(atual?.quantidade||0)+Number(r.quantidade||0)});
    return acc;
  },new Map()).values()].sort((a,b)=>Number(a.potencia)-Number(b.potencia));
  const totalProducao=potencias.reduce((acc,r)=>acc+r.quantidade,0);
  const totalFaltas=faltasDia.reduce((acc,r)=>acc+Number(r.quantidade||0),0);

  return <div className="epoxi-modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="epoxi-day-modal" role="dialog" aria-modal="true" aria-label={`Detalhes do EPOXI em ${formatDate(data)}`}>
      <header className="epoxi-day-modal-header">
        <div>
          <span><CalendarDays className="size-4"/> Detalhes do dia</span>
          <h2>{formatDate(data)}</h2>
          <p><b>EPOXI</b><i/>Linha: EPO{turno!=='Todos'&&<><i/>{turno} turno</>}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar"><X className="size-5"/></button>
      </header>

      <div className="epoxi-day-modal-body">
        <section className="epoxi-day-section">
          <div className="epoxi-day-section-title"><Box className="size-4"/><h3>Produção</h3><span>{fmt(totalProducao)} un.</span></div>
          {potencias.length ? <div className="epoxi-day-table">
            <div className="epoxi-day-table-head"><span>Potência</span><span>Linha</span><span>Quantidade</span></div>
            {potencias.map(r=><div className="epoxi-day-table-row" key={r.potencia}><span>{r.potencia} kVA</span><span>EPO</span><strong>{fmt(r.quantidade)}</strong></div>)}
          </div> : <Empty text="Nenhuma produção registrada."/>}
        </section>

        <section className="epoxi-day-section">
          <div className="epoxi-day-section-title"><UsersRound className="size-4"/><h3>Faltas do dia</h3><span>{fmt(totalFaltas)}</span></div>
          {faltasDia.length ? <div className="epoxi-day-list">{faltasDia.map((r,i)=><div key={`${r.turno}-${i}`}><span>{r.turno} turno</span><strong>{fmt(Number(r.quantidade||0))}</strong></div>)}</div> : <Empty text="Nenhuma falta registrada."/>}
        </section>

        <section className="epoxi-day-section epoxi-day-section--notes">
          <div className="epoxi-day-section-title"><AlertTriangle className="size-4"/><h3>Ocorrências / observações</h3><span>{obsDia.length}</span></div>
          {obsDia.length ? <div className="epoxi-day-notes">{obsDia.map((r,i)=><div key={i}>{r.observacao ?? r.texto ?? '—'}</div>)}</div> : <Empty text="Nenhuma ocorrência registrada."/>}
        </section>
      </div>
      <footer className="epoxi-day-modal-footer"><button type="button" onClick={onClose}>Fechar</button></footer>
    </section>
  </div>;
}
function Empty({text}:{text:string}){return <div className="epoxi-day-empty">{text}</div>}
