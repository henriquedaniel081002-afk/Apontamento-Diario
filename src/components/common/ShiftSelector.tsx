import React from 'react';
import { Turno } from '../../types';

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
    <div className="flex flex-col space-y-1.5">
      {label && <label className="text-xs font-semibold text-slate-300">{label}</label>}
      <div className="inline-flex p-1 bg-white/[0.06] rounded-lg border border-white/10 w-fit">
        {options.map((shift) => {
          const isSelected = selectedShift === shift;
          return (
            <button
              key={shift}
              type="button"
              onClick={() => onChange(shift)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                isSelected
                  ? 'bg-emerald-500 text-[#041007] shadow-xs font-bold'
                  : 'text-slate-500 hover:text-slate-100 hover:bg-white/10'
              }`}
            >
              {shift}
            </button>
          );
        })}
      </div>
    </div>
  );
};
