import React from 'react';
import { Linha } from '../../types';

interface LineSelectorProps {
  linhas: Linha[];
  selectedLinha: Linha;
  onChange: (linha: Linha) => void;
  label?: string;
}

export const LineSelector: React.FC<LineSelectorProps> = ({
  linhas,
  selectedLinha,
  onChange,
  label = 'Linha',
}) => {
  if (linhas.length <= 1) {
    return null; // Don't show selector when user has only 1 line
  }

  return (
    <div className="flex flex-col space-y-1.5">
      {label && <label className="text-xs font-semibold text-slate-300">{label}</label>}
      <div className="inline-flex p-1 bg-white/[0.06] rounded-lg border border-white/10 w-fit">
        {linhas.map((linha) => {
          const isSelected = selectedLinha === linha;
          return (
            <button
              key={linha}
              type="button"
              onClick={() => onChange(linha)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                isSelected
                  ? 'bg-emerald-500 text-[#041007] shadow-xs'
                  : 'text-slate-500 hover:text-slate-100 hover:bg-white/10'
              }`}
            >
              {linha}
            </button>
          );
        })}
      </div>
    </div>
  );
};
