import React from 'react';
import { AlertTriangle, Boxes, MessageSquareText, Settings, UserX, Zap } from 'lucide-react';
import { Surface } from '../common/ui';

interface SummaryHeaderProps {
  totalProducao: number;
  totalParadasMaterial: number;
  totalParadasMaquina: number;
  totalNaoConformidades: number;
  totalFaltas: number;
  totalObservacoes: number;
}

const metrics = [
  { key: 'producao', label: 'Produção', icon: Zap, className: 'bg-[var(--accent-soft)] text-[var(--accent)]' },
  { key: 'material', label: 'Falta material', icon: Boxes, className: 'bg-amber-400/10 text-amber-300' },
  { key: 'maquina', label: 'Máquina', icon: Settings, className: 'bg-rose-400/10 text-rose-300' },
  { key: 'nc', label: 'Não conform.', icon: AlertTriangle, className: 'bg-sky-400/10 text-sky-300' },
  { key: 'faltas', label: 'Faltas', icon: UserX, className: 'bg-[var(--warning-soft)] text-[var(--warning)]' },
  { key: 'observacoes', label: 'Observações', icon: MessageSquareText, className: 'bg-white/[0.06] text-[var(--text-secondary)]' },
] as const;

export const SummaryHeader: React.FC<SummaryHeaderProps> = (props) => {
  const values = {
    producao: props.totalProducao,
    material: props.totalParadasMaterial,
    maquina: props.totalParadasMaquina,
    nc: props.totalNaoConformidades,
    faltas: props.totalFaltas,
    observacoes: props.totalObservacoes,
  };
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9.5rem),1fr))] gap-3" aria-label="Resumo do apontamento">{metrics.map((metric) => { const Icon = metric.icon; const value = values[metric.key]; return <Surface key={metric.key} tone="muted" padding="sm" className="kpi-industrial flex min-w-0 items-center gap-3"><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${metric.className}`} aria-hidden="true"><Icon className="size-4" /></span><div className="min-w-0"><span className="block truncate text-xs font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)]">{metric.label}</span><span className="mt-1 block text-[clamp(1.125rem,2vw,1.4rem)] font-extrabold leading-none text-[var(--text-primary)]">{value}{metric.key === 'producao' && <span className="ml-1 text-xs font-medium text-[var(--text-tertiary)]">unid.</span>}</span></div></Surface>; })}</div>;
};
