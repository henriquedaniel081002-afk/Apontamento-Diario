import type { ReactNode } from 'react';
import {
  Box,
  CalendarDays,
  Clock3,
  Funnel,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CustomSelect } from '../../components/common/CustomSelect';
import { cn } from '../lib/utils';

type FilterSelectProps = {
  id: string;
  label: string;
  options: string[];
  selected: string;
  onSelect?: (value: string) => void;
  compact?: boolean;
  defaultValue?: string;
  active?: boolean;
  formatOption?: (value: string) => string;
  disabled?: boolean;
};

type FilterBarProps = {
  children: ReactNode;
  onClear?: () => void;
  clearDisabled?: boolean;
  note?: string;
};

const FILTER_ICONS: Record<string, LucideIcon> = {
  Mês: CalendarDays,
  Linha: SlidersHorizontal,
  Setor: Box,
  Turno: Clock3,
};

export function FilterBar({ children, onClear, clearDisabled = false, note }: FilterBarProps) {
  return (
    <section className="dash-filter-panel" aria-label="Filtros do dashboard">
      <div className="dash-filter-panel__title">
        <Funnel className="size-4 text-text-secondary" aria-hidden="true" />
        <span>Filtros</span>
      </div>

      <div className="dash-filter-panel__fields">{children}</div>

      <div className="dash-filter-panel__actions">
        {note && <span className="hidden text-xs text-text-secondary 2xl:inline">{note}</span>}
        <button
          type="button"
          onClick={onClear}
          disabled={clearDisabled || !onClear}
          className="clear-filters-button"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Limpar filtros
        </button>
      </div>
    </section>
  );
}

export function FilterSelect({
  id,
  label,
  options,
  selected,
  onSelect,
  compact,
  defaultValue,
  active = false,
  formatOption = (option) => option,
  disabled = false,
}: FilterSelectProps) {
  const activeState = defaultValue !== undefined ? selected !== defaultValue : active;
  const Icon = FILTER_ICONS[label] ?? SlidersHorizontal;

  return (
    <div className={cn('dashboard-filter', compact ? 'dashboard-filter--compact' : '')}>
      <label htmlFor={id} className="dashboard-filter__label">{label}</label>
      <div className="relative">
        <Icon
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2',
            activeState ? 'text-status-planned' : 'text-text-secondary',
          )}
          aria-hidden="true"
        />
        <CustomSelect
          id={id}
          value={selected}
          onChange={(value) => onSelect?.(value)}
          options={options.map((option) => ({ value: option, label: formatOption(option) }))}
          ariaLabel={label}
          active={activeState}
          disabled={disabled}
          className="dashboard-filter__select disabled:cursor-not-allowed disabled:opacity-70"
        />
      </div>
    </div>
  );
}
