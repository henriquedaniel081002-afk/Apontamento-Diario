import { AlertTriangle, BadgeAlert, Box, PackageX, UsersRound, Wrench } from 'lucide-react';
import { ModalShell } from '../../components/common/ModalShell';
import type { DetalheProducao, Falta, FaltaMaterial, MaquinaQuebrada, NaoConformidade, Observacao } from './DayDetailModal';

const fmt = (value:number) => Math.round(value).toLocaleString('pt-BR');
const formatDate = (value:string) => {
  const [y,m,d]=value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(y,m-1,d));
};

export function EpoxiDayDetailModal({data,detalhes,faltas,observacoes,faltasMaterial,maquinasQuebradas,naoConformidades,turno,onClose}:{
  data:string;
  detalhes:DetalheProducao[];
  faltas:Falta[];
  observacoes:Observacao[];
  faltasMaterial:FaltaMaterial[];
  maquinasQuebradas:MaquinaQuebrada[];
  naoConformidades:NaoConformidade[];
  turno:string;
  onClose:()=>void;
}) {
  const producao = detalhes.filter(r=>r.data===data && r.setor==='EPOXI' && (!r.linha || r.linha==='EPO') && (turno==='Todos'||r.turno===turno));
  const faltasDia = faltas.filter(r=>r.data===data && r.setor==='EPOXI' && (!r.linha || r.linha==='EPO') && (turno==='Todos'||r.turno===turno));
  const obsDia = observacoes.filter(r=>r.data===data && r.setor==='EPOXI' && (!r.linha || r.linha==='EPO') && (turno==='Todos'||!r.turno||r.turno===turno));
  const materialDia = faltasMaterial.filter(r=>r.data===data && r.setor==='EPOXI' && (turno==='Todos'||!r.turno||r.turno===turno));
  const maquinasDia = maquinasQuebradas.filter(r=>r.data===data && r.setor==='EPOXI' && (turno==='Todos'||!r.turno||r.turno===turno));
  const ncDia = naoConformidades.filter(r=>r.data===data && r.setor==='EPOXI' && (turno==='Todos'||!r.turno||r.turno===turno));
  const potencias = [...producao.reduce<Map<string,{potencia:string;turno?:string;quantidade:number}>>((acc,r)=>{
    const key=`${String(r.potencia)}|${r.turno||''}`;
    const atual=acc.get(key);
    acc.set(key,{potencia:String(r.potencia),turno:r.turno,quantidade:(atual?.quantidade||0)+Number(r.quantidade||0)});
    return acc;
  },new Map()).values()].sort((a,b)=>Number(a.potencia)-Number(b.potencia)||String(a.turno||'').localeCompare(String(b.turno||''),'pt-BR'));
  const totalProducao=potencias.reduce((acc,r)=>acc+r.quantidade,0);
  const totalFaltas=faltasDia.reduce((acc,r)=>acc+Number(r.quantidade||0),0);

  return <ModalShell
    isOpen
    onClose={onClose}
    size="lg"
    presentation="drawer"
    title={formatDate(data)}
    description={`EPOXI • Linha EPO${turno!=='Todos'?` • ${turno} turno`:''}`}
    closeLabel="Fechar detalhes do EPOXI"
    className="epoxi-day-modal"
    footer={<div className="epoxi-day-modal-footer"><button type="button" onClick={onClose}>Fechar</button></div>}
  >
      <div className="epoxi-day-modal-body" aria-label="Detalhes do dia no setor EPOXI">
        <section className="epoxi-day-section">
          <div className="epoxi-day-section-title"><Box className="size-4"/><h3>Produção</h3><span>{fmt(totalProducao)} un.</span></div>
          {potencias.length ? <div className="epoxi-table-scroll"><table className="epoxi-day-table">
            <thead><tr><th scope="col">Potência</th><th scope="col">Linha</th><th scope="col">Turno</th><th scope="col">Quantidade</th></tr></thead>
            <tbody>{potencias.map(r=><tr key={`${r.potencia}-${r.turno||'sem-turno'}`}><td>{r.potencia} kVA</td><td>EPO</td><td>{r.turno ? `${r.turno} turno` : '—'}</td><td><strong>{fmt(r.quantidade)}</strong></td></tr>)}</tbody>
          </table></div> : <Empty text="Nenhuma produção registrada."/>}
        </section>

        <section className="epoxi-day-section">
          <div className="epoxi-day-section-title"><UsersRound className="size-4"/><h3>Faltas do dia</h3><span>{fmt(totalFaltas)}</span></div>
          {faltasDia.length ? <div className="epoxi-day-list">{faltasDia.map((r,i)=><div key={`${r.turno}-${i}`}><span>{r.turno} turno</span><strong>{fmt(Number(r.quantidade||0))}</strong></div>)}</div> : <Empty text="Nenhuma falta registrada."/>}
        </section>

        <section className="epoxi-day-section epoxi-day-section--notes">
          <div className="epoxi-day-section-title"><AlertTriangle className="size-4"/><h3>Ocorrências / observações</h3><span>{obsDia.length}</span></div>
          {obsDia.length ? <div className="epoxi-day-notes">{obsDia.map((r,i)=><div key={i}>{r.observacao ?? r.texto ?? '—'}</div>)}</div> : <Empty text="Nenhuma ocorrência registrada."/>}
        </section>

        <section className="epoxi-day-section">
          <div className="epoxi-day-section-title"><PackageX className="size-4"/><h3>Falta de material</h3><span>{materialDia.length}</span></div>
          {materialDia.length ? <div className="epoxi-day-notes">{materialDia.map((r,i)=><div key={`${r.material||'material'}-${i}`}><strong>{r.material || 'Material não informado'}</strong>{r.causaMotivo ? ` • ${r.causaMotivo}` : ''}{r.turno ? ` • ${r.turno} turno` : ''}</div>)}</div> : <Empty text="Nenhuma falta de material registrada."/>}
        </section>

        <section className="epoxi-day-section">
          <div className="epoxi-day-section-title"><Wrench className="size-4"/><h3>Máquinas / equipamentos</h3><span>{maquinasDia.length}</span></div>
          {maquinasDia.length ? <div className="epoxi-day-notes">{maquinasDia.map((r,i)=><div key={`${r.maquinaEquipamento||'maquina'}-${i}`}><strong>{r.maquinaEquipamento || 'Máquina não informada'}</strong>{r.observacao ? ` • ${r.observacao}` : ''}{r.turno ? ` • ${r.turno} turno` : ''}</div>)}</div> : <Empty text="Nenhuma parada de máquina registrada."/>}
        </section>

        <section className="epoxi-day-section">
          <div className="epoxi-day-section-title"><BadgeAlert className="size-4"/><h3>Não conformidades</h3><span>{ncDia.length}</span></div>
          {ncDia.length ? <div className="epoxi-day-notes">{ncDia.map((r,i)=><div key={`${r.op||'nc'}-${i}`}><strong>{r.causa || 'Causa não informada'}</strong>{r.op ? ` • OP ${r.op}` : ''}{r.numeroSerie ? ` • Série ${r.numeroSerie}` : ''}{r.turno ? ` • ${r.turno} turno` : ''}</div>)}</div> : <Empty text="Nenhuma não conformidade registrada."/>}
        </section>
      </div>
  </ModalShell>;
}
function Empty({text}:{text:string}){return <div className="epoxi-day-empty">{text}</div>}
