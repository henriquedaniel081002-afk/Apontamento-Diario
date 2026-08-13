import React from 'react';
import { Apontamento } from '../../types';
import { formatDateBR, formatPotencia } from '../../utils/formatters';
import { X, Calendar, Zap, UserX, MessageSquareText, Layers, Clock } from 'lucide-react';

interface DetailModalProps {
  apontamento: Apontamento | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DetailModal: React.FC<DetailModalProps> = ({
  apontamento,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !apontamento) return null;

  const totalUnidades = apontamento.producoes.reduce((sum, p) => sum + p.quantidade, 0);
  const totalFaltas = apontamento.faltas.reduce((sum, f) => sum + f.quantidade, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[#0D120F] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-white/10 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-white/5 flex items-start justify-between bg-[#090D0A]">
          <div>
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 mb-1">
              <Calendar className="w-4 h-4" />
              <span>APONTAMENTO DE {formatDateBR(apontamento.data)}</span>
            </div>
            <h2 className="text-xl font-extrabold text-slate-100 tracking-tight">
              Setor: {apontamento.setor}
            </h2>
            <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
              <span>Operador/Acesso: <strong>{apontamento.userName}</strong></span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Summary Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-emerald-400 uppercase">Produção Total</span>
              <p className="text-lg font-extrabold text-emerald-100 mt-0.5">{totalUnidades} unid.</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-amber-400 uppercase">Faltas</span>
              <p className="text-lg font-extrabold text-amber-100 mt-0.5">{totalFaltas}</p>
            </div>
            <div className="bg-[#090D0A] border border-white/10 rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Observações</span>
              <p className="text-lg font-extrabold text-slate-100 mt-0.5">{apontamento.observacoes.length}</p>
            </div>
          </div>

          {/* Produção Section */}
          <div>
            <div className="flex items-center space-x-2 mb-3 pb-1 border-b border-white/5">
              <Zap className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Produção por Potência</h3>
            </div>

            {apontamento.producoes.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-[#090D0A] p-3 rounded-lg text-center">Nenhuma produção registrada neste dia.</p>
            ) : (
              <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden bg-[#0D120F]">
                {apontamento.producoes.map((prod) => (
                  <div key={prod.id} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                        {prod.linha}
                      </span>
                      <span className="font-bold text-slate-100">
                        {prod.potenciaFormatted || formatPotencia(prod.potencia)} kVA
                      </span>
                    </div>
                    <span className="font-bold text-emerald-300 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                      {prod.quantidade} unidades
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Faltas Section */}
          <div>
            <div className="flex items-center space-x-2 mb-3 pb-1 border-b border-white/5">
              <UserX className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Faltas</h3>
            </div>

            {apontamento.faltas.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-[#090D0A] p-3 rounded-lg text-center">Nenhuma falta registrada neste dia.</p>
            ) : (
              <div className="space-y-2">
                {apontamento.faltas.map((f) => (
                  <div key={f.id} className="p-3 border border-white/10 rounded-xl bg-[#090D0A] text-xs space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">{f.linha}</span>
                      <span className="bg-amber-500/15 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md">{f.turno}</span>
                      <span className="font-bold text-slate-100">{f.quantidade} faltas</span>
                    </div>
                    {f.justificativa && (
                      <p className="text-slate-500 text-[11px] pt-1">
                        <strong>Justificativa:</strong> {f.justificativa}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações Section */}
          <div>
            <div className="flex items-center space-x-2 mb-3 pb-1 border-b border-white/5">
              <MessageSquareText className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">Observações Operacionais</h3>
            </div>

            {apontamento.observacoes.length === 0 ? (
              <p className="text-xs text-slate-500 italic bg-[#090D0A] p-3 rounded-lg text-center">Nenhuma observação registrada neste dia.</p>
            ) : (
              <div className="space-y-2">
                {apontamento.observacoes.map((obs) => (
                  <div key={obs.id} className="p-3 border border-white/10 rounded-xl bg-[#0D120F] text-xs space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-md">{obs.linha}</span>
                      <span className="bg-white/[0.06] text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/10">{obs.turno}</span>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed pt-0.5 font-medium">
                      {obs.observacao}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#090D0A] border-t border-white/5 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center space-x-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Última atualização: {new Date(apontamento.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#041007] font-bold rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
