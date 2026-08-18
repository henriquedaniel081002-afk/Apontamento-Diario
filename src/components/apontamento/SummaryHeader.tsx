import React from 'react';
import { MessageSquareText, UserX, Zap } from 'lucide-react';
import { Surface } from '../common/ui';

interface SummaryHeaderProps {
  totalProducao: number;
  totalFaltas: number;
  totalObservacoes: number;
}

const metrics = [
  {
    key: 'producao',
    label: 'Produção',
    icon: Zap,
    iconClassName: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  },
  {
    key: 'faltas',
    label: 'Faltas',
    icon: UserX,
    iconClassName: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  },
  {
    key: 'observacoes',
    label: 'Observações',
    icon: MessageSquareText,
    iconClassName: 'bg-white/[0.06] text-[var(--text-secondary)]',
  },
] as const;

export const SummaryHeader: React.FC<SummaryHeaderProps> = ({
  totalProducao,
  totalFaltas,
  totalObservacoes,
}) => {
  const values = {
    producao: totalProducao,
    faltas: totalFaltas,
    observacoes: totalObservacoes,
  };

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Resumo do apontamento">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        const value = values[metric.key];
        return (
          <Surface key={metric.key} tone="muted" padding="sm" className="kpi-industrial flex min-w-0 flex-col items-start gap-2 sm:min-h-20 sm:flex-row sm:items-center sm:gap-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl ${metric.iconClassName}`}>
              <Icon aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)] sm:text-xs sm:tracking-[0.12em]">
                {metric.label}
              </span>
              <span className="mt-1 block text-lg font-extrabold leading-none tracking-tight text-[var(--text-primary)] sm:text-xl">
                {value}
                {metric.key === 'producao' && (
                  <span className="ml-1 text-xs font-medium text-[var(--text-tertiary)]">unid.</span>
                )}
              </span>
            </div>
          </Surface>
        );
      })}
    </div>
  );
};
