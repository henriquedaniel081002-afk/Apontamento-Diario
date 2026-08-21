import { useId } from 'react';
import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Flag,
  Info,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../lib/utils';

export type MetricTrend = 'up' | 'down';

export type MetricPanelsProps = {
  adherence: {
    value: string;
    trend: MetricTrend;
  };
  goal: {
    value: string;
    percent: number;
  };
  auxiliary: {
    programmedAverage: string;
    producedAverage: string;
    producedAverageTrend: MetricTrend;
    workingDays: string;
  };
  operational: {
    partialProgrammed: string;
    partialProduced: string;
    partialProducedTrend: MetricTrend;
    totalProgrammed: string;
  };
};

export function MetricPanels({ adherence, goal, auxiliary, operational }: MetricPanelsProps) {
  return (
    <section className="metrics-control-grid" aria-label="Indicadores do período">
      <div><AdherenceGauge value={adherence.value} trend={adherence.trend} /></div>
      <div><GoalGauge value={goal.value} percent={goal.percent} /></div>
      <aside className="control-auxiliary-panel" aria-labelledby="auxiliary-metrics-title">
        <div className="control-panel-heading"><span /><h3 id="auxiliary-metrics-title">Indicadores auxiliares</h3><span /></div>
        <div className="control-auxiliary-grid">
          <AuxiliaryMetric title="Média Programada" value={auxiliary.programmedAverage} description="Programado parcial / dias úteis" icon={Scale} accent="green" />
          <AuxiliaryMetric title="Média Produzida" value={auxiliary.producedAverage} description="Produzido parcial / dias úteis" icon={TrendingUp} trend={auxiliary.producedAverageTrend} accent="blue" />
          <AuxiliaryMetric title="Dias Úteis" value={auxiliary.workingDays} description="Dias com registro no apontamento" icon={CalendarDays} accent="amber" />
        </div>
      </aside>
      <div className="control-operational-grid" aria-label="Volumes programados e produzidos">
        <OperationalCard title="Programado Parcial" value={operational.partialProgrammed} description="Programado até o dia anterior" icon={CalendarRange} accent="blue" />
        <OperationalCard title="Produzido Parcial" value={operational.partialProduced} description="Produzido até o dia anterior" icon={CheckCircle2} trend={operational.partialProducedTrend} accent="green" />
        <OperationalCard title="Programado Total" value={operational.totalProgrammed} description="Programação completa do mês" icon={Flag} accent="blue" />
      </div>
    </section>
  );
}

function AdherenceGauge({ value, trend }: { value: string; trend: MetricTrend }) {
  const titleId = useId();
  const descriptionId = useId();
  const isPositive = trend === 'up';
  const numeric = Number(value.replace('%', '').replace('.', '').replace(',', '.'));
  const progress = Number.isFinite(numeric) ? Math.min(Math.max(numeric / 150 * 100, 0), 100) : 0;

  return (
    <article
      className={cn('control-primary-card', 'control-primary-card--adherence', !isPositive && 'control-primary-card--danger')}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className={cn('control-gauge', !isPositive && 'control-gauge--danger')} style={{ '--gauge-progress': `${progress * 3.6}deg` } as CSSProperties} aria-hidden="true">
        <div className="control-gauge__inner">
          {isPositive ? <TrendingUp className="size-7" /> : <TrendingDown className="size-7" />}
        </div>
      </div>

      <div className="control-primary-card__body">
        <h3 id={titleId}>Aderência mensal</h3>
        <span className={cn('control-primary-value', isPositive ? 'positive' : 'negative')}>{value}</span>
        <TrendBadge trend={trend} />
        <div className="control-scale" aria-hidden="true">
          <span className="control-scale__fill control-scale__fill--green" style={{ width: `${progress}%` }} />
        </div>
        <div className="control-scale__labels"><span>0%</span><span>100%</span><span>150%</span></div>
        <p id={descriptionId}><Info className="size-3.5" /> Produzido parcial / programado parcial</p>
      </div>
    </article>
  );
}

function GoalGauge({ value, percent }: { value: string; percent: number }) {
  const titleId = useId();
  const descriptionId = useId();
  const safePercent = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0;

  return (
    <article className="control-primary-card control-primary-card--goal" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="control-gauge control-gauge--blue" style={{ '--gauge-progress': `${safePercent * 3.6}deg` } as CSSProperties} aria-hidden="true">
        <div className="control-gauge__inner"><Target className="size-7" /></div>
      </div>

      <div className="control-primary-card__body">
        <h3 id={titleId}>Alcance de meta</h3>
        <span className="control-primary-value control-primary-value--blue">{value}</span>
        <div className="control-scale" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safePercent}>
          <span className="control-scale__fill control-scale__fill--blue" style={{ width: `${safePercent}%` }} />
        </div>
        <div className="control-scale__labels"><span>0%</span><span>100%</span></div>
        <p id={descriptionId}><Info className="size-3.5" /> Produzido parcial / programado total</p>
      </div>
    </article>
  );
}

function AuxiliaryMetric({
  title,
  value,
  description,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  trend?: MetricTrend;
  accent: 'green' | 'blue' | 'amber';
}) {
  return (
    <article className="control-auxiliary-metric">
      <span className={`control-round-icon control-round-icon--${accent}`} aria-hidden="true"><Icon className="size-5" /></span>
      <div className="control-auxiliary-metric__content">
        <h4>{title}</h4>
        <div className="control-auxiliary-metric__value-row">
          <strong>{value}</strong>
          {trend && <TrendBadge trend={trend} compact />}
        </div>
        <p>{description}</p>
      </div>
    </article>
  );
}

function OperationalCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  trend?: MetricTrend;
  accent: 'blue' | 'green';
}) {
  return (
    <article className={`control-operational-card control-operational-card--${accent}`}>
      <span className={`control-operational-card__icon control-operational-card__icon--${accent}`} aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <h4>{title}</h4>
      <div className="control-operational-card__value-row">
        <strong>{value}</strong>
        {trend && <TrendBadge trend={trend} compact />}
      </div>
      <p>{description}</p>
      <span className="control-operational-card__accent" aria-hidden="true" />
    </article>
  );
}

function TrendBadge({ trend, compact = false }: { trend: MetricTrend; compact?: boolean }) {
  const isPositive = trend === 'up';
  return (
    <span className={cn('trend-badge', compact ? 'trend-badge--compact' : '', isPositive ? 'trend-badge--positive' : 'trend-badge--negative')}>
      {isPositive ? <TrendingUp className="size-3.5" aria-hidden="true" /> : <TrendingDown className="size-3.5" aria-hidden="true" />}
      {isPositive ? 'Acima' : 'Abaixo'}
    </span>
  );
}
