import { AlertCircle, CalendarClock, CheckCircle2, ClockAlert, PackageCheck, Timer } from 'lucide-react';
import { MetricCard, type MetricCardTone } from '../components/common/ui';

const metrics = [
  {key:'ops_atrasadas', label:'OPs atrasadas', tone:'danger', icon:ClockAlert, description:'Ordens com atraso'},
  {key:'transformadores_vencidos', label:'Transformadores vencidos', tone:'danger', icon:AlertCircle, description:'Unidades pendentes vencidas'},
  {key:'produzidos_fora_prazo', label:'Produzidos fora do prazo', tone:'info', icon:PackageCheck, description:'Produção após a data'},
  {key:'sem_justificativa', label:'Sem justificativa', tone:'warning', icon:Timer, description:'Pendências sem motivo'},
  {key:'prazo_vencido', label:'Prazo vencido', tone:'danger', icon:CalendarClock, description:'Regularização fora do prazo'},
  {key:'regularizados', label:'Regularizados', tone:'success', icon:CheckCircle2, description:'Situações regularizadas'},
] as const;

export function OpKpis({values,loading}:{values?:Record<string,number>;loading:boolean}) {
  return <section aria-label="Indicadores da Visão OP" aria-busy={loading}>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
      {metrics.map(({key,label,tone,icon:Icon,description})=><MetricCard
        key={key} label={label} value={values?Number(values[key]||0).toLocaleString('pt-BR'):'—'}
        description={description} icon={<Icon className="size-5" aria-hidden="true"/>}
        tone={tone as MetricCardTone} className="min-h-36"
      />)}
    </div>
    <p className="mt-2 text-xs leading-5 text-slate-400">Todos os filtros se aplicam aos indicadores, em todas as páginas. OPs e transformadores são distintos; demais indicadores contam OP/setor ou produção em cada setor.</p>
  </section>;
}
