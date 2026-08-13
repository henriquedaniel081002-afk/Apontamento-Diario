import React from 'react';
import { Zap, UserX, MessageSquareText } from 'lucide-react';

interface SummaryHeaderProps {
  totalProducao: number;
  totalFaltas: number;
  totalObservacoes: number;
}

export const SummaryHeader: React.FC<SummaryHeaderProps> = ({
  totalProducao,
  totalFaltas,
  totalObservacoes,
}) => {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-[#0D120F] border border-white/10 rounded-xl p-3 shadow-2xs flex items-center space-x-3">
        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
          <Zap className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Produção</span>
          <span className="text-base font-extrabold text-slate-100 leading-none">
            {totalProducao} <span className="text-xs font-semibold text-slate-500">unid.</span>
          </span>
        </div>
      </div>

      <div className="bg-[#0D120F] border border-white/10 rounded-xl p-3 shadow-2xs flex items-center space-x-3">
        <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
          <UserX className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Faltas</span>
          <span className="text-base font-extrabold text-slate-100 leading-none">
            {totalFaltas}
          </span>
        </div>
      </div>

      <div className="bg-[#0D120F] border border-white/10 rounded-xl p-3 shadow-2xs flex items-center space-x-3">
        <div className="p-2 bg-white/[0.06] text-slate-300 rounded-lg shrink-0">
          <MessageSquareText className="w-4 h-4" />
        </div>
        <div>
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Observações</span>
          <span className="text-base font-extrabold text-slate-100 leading-none">
            {totalObservacoes}
          </span>
        </div>
      </div>
    </div>
  );
};
