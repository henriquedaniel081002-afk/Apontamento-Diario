import { AlertCircle, CalendarClock, CheckCircle2, ClockAlert, PackageCheck, Timer } from 'lucide-react';


const metrics = [
  {key:'ops_atrasadas', label:'OPs atrasadas', tone:'danger', icon:ClockAlert, description:'Ordens com atraso'},
  {key:'transformadores_vencidos', label:'Transformadores vencidos', tone:'danger', icon:AlertCircle, description:'Unidades pendentes vencidas'},
  {key:'produzidos_fora_prazo', label:'Produzidos fora do prazo', tone:'info', icon:PackageCheck, description:'Produção após a data'},
  {key:'sem_justificativa', label:'Sem observação', tone:'warning', icon:Timer, description:'Grupos sem observação'},
  {key:'prazo_vencido', label:'Prazo vencido', tone:'danger', icon:CalendarClock, description:'Regularização fora do prazo'},
  {key:'regularizados', label:'Regularizados', tone:'success', icon:CheckCircle2, description:'Situações regularizadas'},
] as const;

export function OpKpis({values,loading}:{values?:Record<string,number>;loading:boolean}) {
  return <section aria-label="Indicadores da Visão OP" aria-busy={loading}>
    <div className="op-metrics">
      {metrics.map(({key,label,tone,icon:Icon,description},index)=><article key={key}
        className={`control-operational-card op-metric op-metric--${tone} ${index<2?'op-metric--primary':''}`}>
        <div className="flex items-start justify-between gap-3"><h3>{label}</h3><Icon className="size-5 shrink-0" aria-hidden="true"/></div>
        <strong className="op-metric__value">{values?Number(values[key]||0).toLocaleString('pt-BR'):'—'}</strong>
        <p>{description}</p>
      </article>)}
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-400">Todos os filtros se aplicam aos indicadores, em todas as páginas. OPs e transformadores são distintos; os demais indicadores contam grupos diários ou séries produzidas por setor.</p>
  </section>;
}
