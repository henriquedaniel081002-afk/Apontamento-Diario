import React from 'react';
import { Linha } from '../../types';
import { cx } from './ui';

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
  if (linhas.length <= 1) return null;

  return (
    <fieldset className="min-w-0">
      {label && <legend className="mb-2 text-sm font-bold text-slate-300">{label}</legend>}
      <div className="inline-flex w-fit max-w-full gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
        {linhas.map((linha) => {
          const isSelected = selectedLinha === linha;

          return (
            <button
              key={linha}
              type="button"
              onClick={() => onChange(linha)}
              aria-pressed={isSelected}
              className={cx(
                'min-h-11 min-w-12 rounded-lg px-3 text-xs font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300',
                isSelected
                  ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                  : 'text-slate-400 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              {linha}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
};
