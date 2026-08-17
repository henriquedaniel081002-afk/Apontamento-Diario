import React from 'react';
import { Turno } from '../../types';
import { cx } from './ui';

interface ShiftSelectorProps {
  selectedShift: Turno;
  onChange: (shift: Turno) => void;
  label?: string;
}

export const ShiftSelector: React.FC<ShiftSelectorProps> = ({
  selectedShift,
  onChange,
  label = 'Turno',
}) => {
  const options: Turno[] = ['1º turno', '2º turno'];

  return (
    <fieldset className="min-w-0">
      {label && <legend className="mb-2 text-sm font-bold text-slate-300">{label}</legend>}
      <div className="inline-flex w-fit max-w-full gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
        {options.map((shift) => {
          const isSelected = selectedShift === shift;

          return (
            <button
              key={shift}
              type="button"
              onClick={() => onChange(shift)}
              aria-pressed={isSelected}
              className={cx(
                'min-h-10 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300',
                isSelected
                  ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              {shift}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};
